import mongoose from "mongoose";
import Seat from "../model/Seat.js";
import TimeSlot from "../model/TimeSlot.js";
import Booking from "../model/Booking.js";
import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";
import Library from "../model/LibraryModel.js";
import Setting from "../model/Settings.js";
import User from "../model/User.js";

// Helper function to process payment
const processPayment = async (userId, amount, description, bookingIds, session) => {
  const options = { session };
  let wallet = await Wallet.findOne({ user: userId }, null, options);
  
  if (!wallet) {
    wallet = new Wallet({ user: userId, balance: 0 });
    await wallet.save(options);
  }

  if (wallet.balance < amount) {
    throw new Error('Insufficient balance');
  }

  wallet.balance -= amount;
  await wallet.save(options);

  const transaction = new Transaction({
    wallet: wallet._id,
    user: userId,
    type: 'debit',
    amount,
    description,
    bookings: bookingIds,
    status: 'completed'
  });

  await transaction.save(options);
  return transaction;
};

// Helper function to properly format date string
const formatDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Fixed conflict checker with proper date handling
const checkBookingConflicts = async (seat, timeSlot, libraryId, start, end, session) => {
  const requestedStart = new Date(start);
  requestedStart.setHours(0, 0, 0, 0);
  const requestedEnd = new Date(end);
  requestedEnd.setHours(23, 59, 59, 999);

  // Find all conflicting bookings within the requested date range
  const conflicts = await Booking.find({
    seat,
    timeSlot,
    library: libraryId,
    bookingDate: { 
      $gte: requestedStart,
      $lte: requestedEnd 
    },
    status: { $in: ["pending", "confirmed"] }
  })
  .select('bookingDate')
  .session(session);

  // Extract and format just the conflicting dates within the requested range
  const conflictingDates = conflicts.map(booking => {
    const bookingDate = new Date(booking.bookingDate);
    return formatDateString(bookingDate);
  }).filter(date => date !== null);

  // Remove duplicates and sort
  return [...new Set(conflictingDates)].sort();
};

// Helper function to count actual days between dates (inclusive)
const countDaysBetweenDates = (start, end) => {
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  
  const diffTime = endDate - startDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// Helper function to create bookings
const createBookings = async (userId, seatDoc, timeSlotDoc, settings, start, end, transaction, session) => {
  const bookings = [];
  let loopDate = new Date(start);
  loopDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  while (loopDate <= endDate) {
    const bookingDate = new Date(loopDate);
    bookingDate.setHours(0, 0, 0, 0);

    const booking = new Booking({
      user: userId,
      seat: seatDoc._id,
      timeSlot: timeSlotDoc._id,
      library: seatDoc.library,
      bookingDate,
      status: "confirmed",
      paymentStatus: "paid",
      amount: Number(timeSlotDoc.price), // Ensure price is number
      commission: settings.bookingCommission,
      totalAmount: Number(timeSlotDoc.price) + settings.bookingCommission,
      paymentId: transaction._id
    });

    await booking.save({ session });
    bookings.push(booking);
    loopDate = new Date(loopDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return bookings;
};

export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionResult = null;

  try {
    await session.withTransaction(async () => {
      const { seat, timeSlot, startDate, endDate } = req.body;
      const userId = req.user._id;

      // Input validation
      if (!seat || !timeSlot || !startDate) {
        throw { statusCode: 400, message: "Seat, time slot, and start date are required" };
      }

      // Fetch required documents
      const [seatDoc, timeSlotDoc, settings] = await Promise.all([
        Seat.findById(seat).session(session),
        TimeSlot.findById(timeSlot).session(session),
        Setting.findOne().session(session)
      ]);

      // Validate documents
      if (!seatDoc) throw { statusCode: 404, message: "Seat not found" };
      if (!timeSlotDoc) throw { statusCode: 404, message: "Time slot not found" };
      if (!settings) throw { 
        statusCode: 400, 
        message: "System commission settings not configured" 
      };
      if (!timeSlotDoc.isActive) throw { statusCode: 400, message: "Time slot is not active" };

      // Date handling with proper normalization
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : new Date(startDate);
      end.setHours(23, 59, 59, 999);
      
      if (start > end) {
        throw { statusCode: 400, message: "Start date must be before or equal to end date" };
      }

      // Check for conflicts
      const conflictingDates = await checkBookingConflicts(
        seat, timeSlot, seatDoc.library, start, end, session
      );
      
      if (conflictingDates.length > 0) {
        throw {
          statusCode: 400,
          message: "Time slot not available for selected dates",
          conflicts: conflictingDates
        };
      }

      // Calculate exact number of days
      const days = countDaysBetweenDates(start, end);
      
      // Calculate amounts based on days
      const slotPrice = Number(timeSlotDoc.price) * days; // Ensure price is number
      const commission = settings.bookingCommission * days;
      const totalAmount = slotPrice + commission;

      // Process payment with actual amount FIRST
      const transaction = await processPayment(
        userId,
        totalAmount,
        `Booking for ${days} day(s) at ${seatDoc.library}`,
        [], // Will update after creating bookings
        session
      );

      // Create bookings
      const bookings = await createBookings(
        userId, seatDoc, timeSlotDoc, settings, start, end, transaction, session
      );

      // Update transaction with booking IDs
      transaction.bookings = bookings.map(b => b._id);
      await transaction.save({ session });

      // Store result for response
      transactionResult = {
        transaction,
        bookingIds: bookings.map(b => b._id),
        summary: { 
          totalDays: days, 
          slotPrice, 
          commission, 
          totalAmount 
        }
      };
    });

    // Populate bookings for response
    const populatedBookings = await Booking.find({
      _id: { $in: transactionResult.bookingIds }
    })
      .populate("user", "-password")
      .populate("seat")
      .populate("timeSlot")
      .populate("library");

    return res.status(201).json({
      success: true,
      message: `Created ${transactionResult.bookingIds.length} bookings`,
      bookings: populatedBookings,
      transaction: transactionResult.transaction,
      summary: transactionResult.summary
    });

  } catch (error) {
    console.error("Booking error:", error);
    
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || "Booking failed",
    };

    if (error.conflicts) {
      response.conflicts = error.conflicts;
    }

    if (process.env.NODE_ENV === "development") {
      response.error = error.stack;
    }

    return res.status(statusCode).json(response);
  } finally {
    await session.endSession();
  }
};