import mongoose from "mongoose";
import Seat from "../model/Seat.js";
import TimeSlot from "../model/TimeSlot.js";
import Booking from "../model/Booking.js";
import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";
import Library from "../model/LibraryModel.js";
import Setting from "../model/Settings.js";

// Helper function to process payment
const processPayment = async (userId, amount, description, bookingIds) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: 0 });
      await wallet.save({ session });
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    wallet.balance -= amount;
    await wallet.save({ session });

    const transaction = new Transaction({
      wallet: wallet._id,
      user: userId,
      type: 'debit',
      amount,
      description,
      bookings: bookingIds,
      status: 'completed'
    });
    await transaction.save({ session });

    await session.commitTransaction();
    return transaction;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Helper function to process refund
const processRefund = async (userId, amount, description, bookingIds, session = null) => {
  const options = session ? { session } : {};
  const localSession = session ? null : await mongoose.startSession();

  if (localSession) {
    localSession.startTransaction();
  }

  try {
    const wallet = await Wallet.findOne({ user: userId }, null, options);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    wallet.balance += amount;
    await wallet.save(options);

    const transaction = new Transaction({
      wallet: wallet._id,
      user: userId,
      type: 'refund',
      amount,
      description,
      bookings: bookingIds,
      status: 'completed'
    });

    await transaction.save(options);

    if (localSession) {
      await localSession.commitTransaction();
    }
    return transaction;
  } catch (error) {
    if (localSession) {
      await localSession.abortTransaction();
    }
    throw error;
  } finally {
    if (localSession) {
      localSession.endSession();
    }
  }
};


// Create a new booking with commission
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { seat, timeSlot, startDate, endDate } = req.body;
    const userId = req.user._id;

    if (!seat || !timeSlot || !startDate) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Seat, time slot, and start date are required" 
      });
    }

    // Fetch required documents in parallel
    const [seatDoc, timeSlotDoc, settings] = await Promise.all([
      Seat.findById(seat).session(session),
      TimeSlot.findById(timeSlot).session(session),
      Setting.findOne().session(session)
    ]);

    // Validate documents
    if (!seatDoc) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Seat not found" 
      });
    }

    if (!timeSlotDoc) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Time slot not found" 
      });
    }

    if (!timeSlotDoc.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Time slot is not active" 
      });
    }

    if (!settings) {
      await session.abortTransaction();
      return res.status(500).json({ 
        success: false,
        message: "System settings not configured" 
      });
    }

    // Parse dates
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : new Date(startDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Start date must be before or equal to end date" 
      });
    }

    // Check booking conflicts for each date
    const conflictingDates = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStart = new Date(currentDate);
      dateStart.setHours(0, 0, 0, 0);
      
      const dateEnd = new Date(currentDate);
      dateEnd.setHours(23, 59, 59, 999);

      const conflict = await Booking.findOne({
        seat,
        timeSlot,
        library: seatDoc.library,
        bookingDate: {
          $gte: dateStart,
          $lte: dateEnd
        },
        status: { $in: ["pending", "confirmed"] }
      }).session(session);

      if (conflict) {
        conflictingDates.push(new Date(currentDate).toISOString().split('T')[0]);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (conflictingDates.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "This time slot is not available for the selected date(s).",
        conflicts: conflictingDates
      });
    }

    // Calculate booking details
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const slotPrice = timeSlotDoc.price * days;
    const commission = settings.bookingCommission * days; // Commission per day
    const totalAmount = slotPrice + commission;

    // Check wallet balance
    let wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: 0 });
      await wallet.save({ session });
    }

    if (wallet.balance < totalAmount) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Insufficient balance",
        required: totalAmount,
        available: wallet.balance
      });
    }

    // Deduct amount from wallet
    wallet.balance -= totalAmount;
    await wallet.save({ session });

    // Create transaction for the payment
    const transaction = new Transaction({
      wallet: wallet._id,
      user: userId,
      type: "debit",
      amount: totalAmount,
      description: `Booking for ${days} day(s) at ${seatDoc.library}`,
      status: "pending",
      metadata: {
        slotPrice,
        commission,
        days
      }
    });
    await transaction.save({ session });

    // Create bookings for each date
    const bookings = [];
    const dateLoop = new Date(start);
    
    while (dateLoop <= end) {
      const bookingDate = new Date(Date.UTC(
        dateLoop.getFullYear(),
        dateLoop.getMonth(),
        dateLoop.getDate()
      ));

      const booking = new Booking({
        user: userId,
        seat,
        timeSlot,
        library: seatDoc.library,
        bookingDate,
        status: "confirmed",
        paymentStatus: "paid",
        amount: timeSlotDoc.price,
        commission: settings.bookingCommission, // Store commission per booking
        totalAmount: timeSlotDoc.price + settings.bookingCommission, // Store total charged
        paymentId: transaction._id
      });

      await booking.save({ session });
      bookings.push(booking);
      dateLoop.setDate(dateLoop.getDate() + 1);
    }

    // Update transaction with booking references
    transaction.bookings = bookings.map(b => b._id);
    transaction.status = "completed";
    await transaction.save({ session });

    await session.commitTransaction();

    // Return populated bookings
    const populatedBookings = await Booking.find({
      _id: { $in: bookings.map(b => b._id) }
    })
      .populate("user", "-password")
      .populate("seat")
      .populate("timeSlot")
      .populate("library")
      .sort({ bookingDate: 1 });

    res.status(201).json({
      success: true,
      message: `Successfully created ${populatedBookings.length} bookings`,
      bookings: populatedBookings,
      transaction,
      summary: {
        totalDays: days,
        slotPrice,
        commission,
        totalAmount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Booking creation error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    session.endSession();
  }
};


// Get bookings for a user
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const filter = { user: userId };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('seat')
      .populate('timeSlot')
      .populate('library')
      .populate('paymentId')
      .sort({ bookingDate: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get bookings for a library (admin/librarian access)
export const getLibraryBookings = async (req, res) => {
  try {
    const { date, status } = req.query;

    // Get the library assigned to the logged-in user
    const myLibrary = await Library.findOne({ librarian: req.user?._id }).select("_id");

    if (!myLibrary) {
      return res.status(404).json({ message: "Library not found for this user" });
    }

    const libraryId = myLibrary._id;

    const filter = { library: libraryId };

    if (status) filter.status = status;

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.bookingDate = { $gte: startDate, $lte: endDate };
    }

    const bookings = await Booking.find(filter)
      .populate('user', '-password')
      .populate('seat')
      .populate('timeSlot')
      .populate('paymentId')
      .sort({ bookingDate: 1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get bookings for a library (admin/librarian access)
export const getBookingsByLibraryId = async (req, res) => {
  try {
    const { date, status } = req.query;
    const {libraryId} = req.params;
    const filter = { library: libraryId };

    if (status) filter.status = status;

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.bookingDate = { $gte: startDate, $lte: endDate };
    }

    const bookings = await Booking.find(filter)
      .populate('user', '-password')
      .populate('seat')
      .populate('timeSlot')
      .populate('paymentId')
      .sort({ bookingDate: 1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update booking status (for librarian/admin to reject)
export const updateBookingStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user._id;


    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    // Find the booking first to check current status
    const booking = await Booking.findById(id)
      .populate('user', '-password')
      .populate('seat')
      .populate('timeSlot')
      .populate('library')
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Booking not found" });
    }

    // Only allow certain status transitions
    if (status === 'rejected' && booking.status !== 'pending' && booking.status !== 'confirmed') {
      await session.abortTransaction();
      return res.status(400).json({ message: "Cannot reject a booking that's not pending or confirmed" });
    }

    // Process refund if rejecting a pending or confirmed booking
    if (status === 'rejected' && booking.paymentStatus === 'paid') {
      await processRefund(
        booking.user._id,
        booking.amount,
        `Refund for rejected booking on ${booking.bookingDate.toDateString()}`,
        [booking._id],
        session
      );
    }

    // Update booking status
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { 
        status,
        paymentStatus: status === 'rejected' ? 'refunded' : booking.paymentStatus,
        ...(status === 'rejected' && { 
          rejectedAt: new Date(),
          rejectedBy: userId 
        })
      },
      { new: true, runValidators: true, session }
    )
      .populate('user', '-password')
      .populate('seat')
      .populate('timeSlot')
      .populate('library')
      .populate('paymentId');

    await session.commitTransaction();

    res.status(200).json(updatedBooking);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};


// Cancel a booking (for user)
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    // Find the booking first to check current status
    const booking = await Booking.findOne({ _id: id, user: userId })
      .populate('seat')
      .populate('timeSlot')
      .populate('library');

    if (!booking) {
      return res.status(404).json({ message: "Booking not found or not authorized" });
    }

    // Check if booking can be cancelled
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return res.status(400).json({ message: "Only pending or confirmed bookings can be cancelled" });
    }

    // Check cancellation window using the virtual property
    if (!booking.canCancel && booking.status === 'confirmed') {
      return res.status(400).json({ message: "Cancellation window has passed (must cancel at least 1 hour before booking time)" });
    }

    // Process refund if paid
    if (booking.paymentStatus === 'paid') {
      await processRefund(
        userId,
        booking.amount,
        `Refund for cancelled booking on ${booking.bookingDate}`,
        [booking._id]
      );
    }

    // Update booking status
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        paymentStatus: booking.paymentStatus === 'paid' ? 'refunded' : 'failed',
        cancelledAt: new Date()
      },
      { new: true }
    )
      .populate('seat')
      .populate('timeSlot')
      .populate('library')
      .populate('paymentId');

    res.status(200).json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const getAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const total = await Booking.countDocuments();

    const bookings = await Booking.find()
      .populate({
        path: 'user',
        select: 'name email phone role'
      })
      .populate({
        path: 'seat',
        select: 'seatNumber seatName'
      })
      .populate({
        path: 'timeSlot',
        select: 'startTime endTime price'
      })
      .populate({
        path: 'library',
        populate: [
          { path: 'libraryType', select: 'type' },
          { path: 'services', select: 'name icon' },
          { path: 'librarian', select: 'name email phone' }
        ],
        select: 'libraryName email contactNumber libraryType services location pinCode logo images timingFrom timingTo totalBooks isBlocked isPopular'
      })
      .populate({
        path: 'paymentId',
        select: 'amount type status createdAt'
      })
      .populate({
        path: 'rejectedBy',
        select: 'name email'
      })
      .sort({ bookingDate: -1, createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: bookings
    });

  } catch (error) {
    console.error("getAllBookings error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Get all bookings filtered by library and user for current date only
export const getBookingsByLibraryAndUser = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user._id;
    const { 
      page = 1, 
      limit = 10, 
      status,
      sortBy = 'bookingDate',
      sortOrder = 'desc'
    } = req.query;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid library ID" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid user ID" 
      });
    }

    // Get current date range (start of day to end of day)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Build filter
    const filter = {
      library: libraryId,
      user: userId,
      bookingDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };

    // Add status filter if provided
    if (status) {
      filter.status = status;
    }

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Count total matching documents
    const total = await Booking.countDocuments(filter);

    // Get paginated results
    const bookings = await Booking.find(filter)
      .populate({
        path: 'user',
        select: 'name email'
      })
      .populate({
        path: 'seat',
        select: 'seatNumber seatName'
      })
      .populate({
        path: 'timeSlot',
        select: 'startTime endTime price'
      })
      .populate({
        path: 'library',
        select: 'libraryName location'
      })
      .populate({
        path: 'paymentId',
        select: 'amount type status'
      })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      currentDate: now.toISOString().split('T')[0], // Add current date in response
      data: bookings
    });

  } catch (error) {
    console.error("getBookingsByLibraryAndUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
