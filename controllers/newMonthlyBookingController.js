import mongoose from "mongoose";
import MonthlyBooking from "../model/MonthlyBooking.js";
import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";
import Library from "../model/LibraryModel.js";
import Seat from "../model/Seat.js";
import User from "../model/User.js";
import Setting from "../model/Settings.js";
import TimeSlot from "../model/TimeSlot.js";

const checkMonthlyBookingConflicts = async (slotId, seatId, startDate, endDate, session) => {
  const existingBookings = await MonthlyBooking.find({
    seat: seatId,
    timeSlot: slotId,
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ],
    status: { $in: ["confirmed", "pending"] }
  }).session(session);

  return existingBookings.length > 0;
};

export const newCreateMonthlyBooking = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionInProgress = true;
  console.log("req", req.body)
  try {
    await session.withTransaction(async () => {
      try {
        // 1. Input validation
        const { userId, slot, seat, library, from } = req.body;
        
        if (!slot || !seat || !library) {
          throw { statusCode: 400, message: "Seat and library IDs are required", isOperational: true };
        }

        // 2. Fetch data
        const [slotData, seatData, libraryData, user, wallet] = await Promise.all([
          TimeSlot.findById(slot).session(session),
          Seat.findById(seat).session(session),
          Library.findById(library).session(session),
          User.findById(userId).session(session),
          Wallet.findOne({ user: userId }).session(session),
        ]);

        // 3. Validate resources
        const resources = {
          slot: slotData,
          seat: seatData,
          library: libraryData,
          user,
          wallet,
        };

        for (const [key, value] of Object.entries(resources)) {
          if (!value) {
            throw {
              statusCode: 404,
              message: `${key.charAt(0).toUpperCase() + key.slice(1)} not found`,
              isOperational: true,
            };
          }
        }


        if (!slotData.isActive) throw { statusCode: 400, message: "Time slot is not active" };


        // 4. Business validations
        if (slotData.library.toString() !== library) {
          throw {
            statusCode: 400,
            message: "Seat doesn't belong to specified library",
            isOperational: true
          };
        }

        if (!slotData.seats.map(id => id.toString()).includes(seat.toString())) {
          throw {
            statusCode: 400,
            message: "Seat doesn't belong to specified slot",
            isOperational: true
          };
        }


        if (seatData.library.toString() !== library) {
          throw {
            statusCode: 400,
            message: "Seat doesn't belong to specified library",
            isOperational: true
          };
        }
        const commission = await Setting.findOne()
        const bookingCommission = commission?.bookingCommission || 0
        const amount = Number(slotData.price) + Number(bookingCommission);
        // const amount = libraryData.monthlyFee + bookingCommission;
        // if (amount <= 0) {
        //   throw {
        //     statusCode: 400,
        //     message: "Monthly booking not available for this library",
        //     isOperational: true
        //   };
        // }

        if (wallet.balance < amount) {
          throw {
            statusCode: 400,
            message: "Insufficient wallet balance",
            isOperational: true
          };
        }


        // Hamesha Date banalo
        let fromDate = from ? new Date(from) : new Date();

        // Invalid date check (safety)
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid date format"
          });
        }

        // Start date = same din ka 00:00:00
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        endDate.setHours(23, 59, 59, 999);

        if (await checkMonthlyBookingConflicts(slot, seat, startDate, endDate, session)) {
          throw {
            statusCode: 409,
            message: "Slot & Seat already booked for the requested period",
            isOperational: true
          };
        }

        // 7. Process transaction
        wallet.balance -= amount;
        await wallet.save({ session });

        const transaction = new Transaction({
          wallet: wallet._id,
          user: userId,
          type: 'debit',
          amount,
          description: `Monthly booking at ${libraryData.libraryName}`,
          library,
          status: 'completed'
        });
        await transaction.save({ session });

        const monthlyBooking = new MonthlyBooking({
          user: userId,
          timeSlot: slot,
          seat,
          library,
          startDate,
          endDate,
          amount,
          status: "confirmed",
          paymentStatus: "paid",
          paymentId: transaction._id,
          bookedAt: new Date()
        });
        await monthlyBooking.save({ session });

        transaction.monthlyBooking = monthlyBooking._id;
        await transaction.save({ session });

        // 8. Success response
        transactionInProgress = false;
        const populatedBooking = await MonthlyBooking.findById(monthlyBooking._id)
          .populate("user", "name email")
          .populate("timeSlot")
          .populate("seat", "seatNumber floor")
          .populate("library", "libraryName location")
          .populate("paymentId", "amount status createdAt")
          .session(session);

        res.status(201).json({
          success: true,
          data: {
            booking: populatedBooking,
            transaction: {
              id: transaction._id,
              amount: transaction.amount,
              status: transaction.status
            }
          }
        });

      } catch (innerError) {
        // Mark transaction as failed
        transactionInProgress = false;
        throw innerError; // Re-throw to trigger outer catch
      }
    });
  } catch (error) {
    // Handle transaction errors safely
    if (transactionInProgress) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Failed to abort transaction:", abortError);
      }
    }

    // Prepare error response
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || "Booking creation failed",
      ...(error.isOperational ? {} : { systemError: "Internal server error" })
    };

    // Development-only details
    if (process.env.NODE_ENV === "development") {
      response.errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    res.status(statusCode).json(response);
  } finally {
    try {
      await session.endSession();
    } catch (sessionError) {
      console.error("Failed to end session:", sessionError);
    }
  }
};

// Get user's monthly bookings
export const getMyMonthlyBookings = async (req, res) => {
  try {
    const userId = req.params;
    const { status, } = req.query;

    const filter = { user: userId };
    if (status) filter.status = status;

    const bookings = await MonthlyBooking.find(filter)
      .populate('seat')
      .populate('library')
      .populate('paymentId')
      .sort({ bookingDate: -1 })

    res.status(200).json({
      success: true,
      message: "These are your monthly bookings",
      bookings
    });

  } catch (error) {
    console.error("Error fetching monthly bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly bookings"
    });
  }
};

// Cancel a monthly booking
export const cancelMonthlyBooking = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { bookingId } = req.params;
      const userId = req.user._id;

      const booking = await MonthlyBooking.findOne({
        _id: bookingId,
        user: userId
      }).session(session);

      if (!booking) {
        throw { statusCode: 404, message: "Booking not found" };
      }

      // Check if booking can be cancelled
      if (booking.status === "cancelled") {
        throw { statusCode: 400, message: "Booking is already cancelled" };
      }

      if (booking.status === "completed") {
        throw { statusCode: 400, message: "Completed bookings cannot be cancelled" };
      }

      // Check if booking has already started
      const now = new Date();

      // Add 1 day grace period
      const cancelLimit = new Date(booking.startDate);
      cancelLimit.setDate(cancelLimit.getDate() + 1);

      if (now >= cancelLimit) {
        throw {
          statusCode: 400,
          message: "Cannot cancel booking after one day of Booking date"
        };
      }

      // Update booking status
      booking.status = "cancelled";
      await booking.save({ session });

      // Refund payment if applicable
      if (booking.paymentStatus === "paid") {
        const wallet = await Wallet.findOne({ user: userId }).session(session);
        if (wallet) {
          wallet.balance += booking.amount;
          await wallet.save({ session });

          // Create refund transaction
          const refundTransaction = new Transaction({
            wallet: wallet._id,
            user: userId,
            type: 'refund',
            amount: booking.amount,
            description: `Refund for cancelled monthly booking ${booking._id}`,
            library: booking.library,
            status: 'completed'
          });
          await refundTransaction.save({ session });

          // Update booking payment status
          booking.paymentStatus = "refunded";
          await booking.save({ session });

          refundTransaction.monthlyBooking = booking._id
          await refundTransaction.save()


          res.status(200).json({
            success: true,
            message: "Booking cancelled and refund processed",
            booking,
            refundTransaction
          });
          return;
        }
      }



      res.status(200).json({
        success: true,
        message: "Booking cancelled",
        booking
      });
    });
  } catch (error) {
    console.error("Error cancelling monthly booking:", error);

    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || "Failed to cancel booking"
    };

    if (process.env.NODE_ENV === "development") {
      response.error = error.stack;
    }

    res.status(statusCode).json(response);
  } finally {
    await session.endSession();
  }
};


export const newGetMonthlyBookingsForLibrarian = async (req, res) => {
  try {
    const user = req.user._id;
    const { status, date, startDate, endDate, paymentStatus, page = 1, limit = 10 } = req.query;

    const library = await Library.findOne({ librarian: user });
    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Your library not found"
      });
    }

    // Build filter object
    const filter = { library: library._id };

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Date filtering
    if (date) {
      const targetDate = new Date(date);
      filter.startDate = { $lte: targetDate };
      filter.endDate = { $gte: targetDate };
    }

    if (startDate && endDate) {
      filter.startDate = { $lte: new Date(endDate) };
      filter.endDate = { $gte: new Date(startDate) };
    } else if (startDate) {
      filter.endDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.startDate = { $lte: new Date(endDate) };
    }

    // Pagination setup
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * pageSize;

    // Total bookings count (before pagination)
    const totalBookings = await MonthlyBooking.countDocuments(filter);

    // Get paginated bookings
    const bookings = await MonthlyBooking.find(filter)
      .populate("seat")
      .populate("timeSlot")
      .populate("library")
      .populate("paymentId")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Calculate statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await MonthlyBooking.countDocuments({
      ...filter,
      bookedAt: { $gte: today, $lt: tomorrow }
    });

    const statusCounts = await MonthlyBooking.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const paymentStatusCounts = await MonthlyBooking.aggregate([
      { $match: filter },
      { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }
    ]);

    const revenueStats = await MonthlyBooking.aggregate([
      { $match: { ...filter, paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);

    const totalRevenue =
      revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;

    res.status(200).json({
      success: true,
      message: "These are your monthly bookings",
      bookings,
      pagination: {
        total: totalBookings,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(totalBookings / pageSize)
      },
      stats: {
        total: totalBookings,
        today: todayBookings,
        byStatus: statusCounts,
        byPaymentStatus: paymentStatusCounts,
        revenue: totalRevenue
      }
    });
  } catch (error) {
    console.error("Error fetching monthly bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly bookings"
    });
  }
};



// Get user's monthly bookings for admin
export const newGetMonthlyBookingsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      paymentStatus,
      startDate,
      endDate
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter object
    let filter = {};

    // Search filter (user name, email, seat number, library name)
    if (search) {
      filter.$or = [
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } },
        { 'seat.seatNumber': { $regex: search, $options: 'i' } },
        { 'library.libraryName': { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    // Date range filter for booking dates
    if (startDate || endDate) {
      filter.$and = [];

      if (startDate) {
        filter.$and.push({
          $or: [
            { startDate: { $gte: new Date(startDate) } },
            { endDate: { $gte: new Date(startDate) } }
          ]
        });
      }

      if (endDate) {
        filter.$and.push({
          $or: [
            { startDate: { $lte: new Date(endDate) } },
            { endDate: { $lte: new Date(endDate) } }
          ]
        });
      }

      // If no conditions were added, remove the $and array
      if (filter.$and.length === 0) {
        delete filter.$and;
      }
    }

    const total = await MonthlyBooking.countDocuments(filter);

    const bookings = await MonthlyBooking.find(filter)
      .populate({
        path: 'user',
        select: 'name email mobile role'
      })
      .populate({
        path: 'seat',
        select: 'seatNumber seatName'
      })
      .populate("timeSlot")
      .populate({
        path: 'library',
        select: 'libraryName email contactNumber location timingFrom timingTo'
      })
      .populate({
        path: 'paymentId',
        select: 'amount type status createdAt'
      })
      .sort({ bookedAt: -1, createdAt: -1 })
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
    console.error("Error fetching monthly bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly bookings"
    });
  }
};
