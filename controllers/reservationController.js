// controllers/reservationController.js
import mongoose from "mongoose";
import qr from "qr-image";
import Reservation from "../model/Reservation.js";
import Seat from "../model/Seat.js";
import User from "../model/User.js"; // Assuming you have a User model
import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";

// Helper function to generate QR code
const generateQRCode = (reservationData) => {
  try {
    const text = JSON.stringify({
      reservationId: reservationData._id,
      studentId: reservationData.student,
      seatId: reservationData.seat,
      libraryId: reservationData.library,
      startDate: reservationData.startDate,
      endDate: reservationData.endDate,
      timeSlot: reservationData.timeSlot
    });

    const qr_png = qr.imageSync(text, { type: 'png' });
    return qr_png.toString('base64');
  } catch (err) {
    console.error("QR generation error:", err);
    return null;
  }
};

// Helper function to ensure QR code exists
const ensureQRCode = async (reservation) => {
  if (!reservation.qrCode) {
    const qrCode = generateQRCode(reservation);
    if (qrCode) {
      reservation.qrCode = qrCode;
      await reservation.save();
    }
  }
  return reservation;
};

// Helper function to update timeSlot booking status
const updateTimeSlotBooking = async (seatId, timeSlotId, userId, isBooked) => {
  try {
    const updateOperation = isBooked 
      ? { 
          $set: { 
            "timeSlots.$[slot].isBooked": true,
            "timeSlots.$[slot].bookedBy": userId
          },
          $push: {
            "timeSlots.$[slot].bookings": {
              user: userId,
              isActive: true,
              bookedAt: new Date()
            }
          }
        }
      : {
          $set: { 
            "timeSlots.$[slot].isBooked": false,
            "timeSlots.$[slot].bookedBy": null
          },
          $pull: {
            "timeSlots.$[slot].bookings": { user: userId, isActive: true }
          }
        };

    const updatedSeat = await Seat.findByIdAndUpdate(
      seatId, 
      updateOperation,
      {
        arrayFilters: [{ "slot._id": timeSlotId }],
        new: true
      }
    );

    if (!updatedSeat) {
      throw new Error('Seat not found');
    }

    return updatedSeat;
  } catch (error) {
    console.error("Error updating time slot booking:", error);
    throw error;
  }
};

// Helper function to check for booking conflicts
const hasBookingConflict = async (seatId, timeSlotId, startDate, endDate, excludeReservationId = null) => {
  try {
    const conditions = {
      seat: seatId,
      "timeSlot._id": timeSlotId,
      status: "active",
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } }
      ]
    };

    if (excludeReservationId) {
      conditions._id = { $ne: excludeReservationId };
    }

    const count = await Reservation.countDocuments(conditions);
    return count > 0;
  } catch (error) {
    console.error("Error checking booking conflicts:", error);
    throw error;
  }
};

// Helper function to validate reservation dates
const validateReservationDates = (startDate, endDate) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if end date is before start date
  if (start > end) {
    return {
      valid: false,
      message: "End date must be on or after start date"
    };
  }

  // Check if start date is in the past
  if (start < now.setHours(0, 0, 0, 0)) {
    return {
      valid: false,
      message: "Start date cannot be in the past"
    };
  }

  return {
    valid: true
  };
};



export const createReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { library, seat, timeSlot, startDate, endDate } = req.body;
    const student = req.user._id
    // Validate input
    if (!student || !library || !seat || !timeSlot || !startDate || !endDate) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Missing required fields" });
    }

    const dateValidation = validateReservationDates(startDate, endDate);
    if (!dateValidation.valid) {
      await session.abortTransaction();
      return res.status(400).json({ message: dateValidation.message });
    }

    // Validate student
    const user = await User.findById(student).session(session);
    if (!user || user.role !== "student") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid student user" });
    }

    // Validate seat
    const seatDoc = await Seat.findById(seat).session(session);
    if (!seatDoc || !seatDoc.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid or inactive seat" });
    }

    const timeSlotDoc = seatDoc.timeSlots.id(timeSlot);
    if (!timeSlotDoc) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Specified time slot not found" });
    }

    if (timeSlotDoc.isBooked) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Time slot already booked", bookedBy: timeSlotDoc.bookedBy });
    }

    // Check for booking conflict
    if (await hasBookingConflict(seat, timeSlot, startDate, endDate)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Time slot is already booked for the selected date range" });
    }

    // 🔻 NEW: Wallet deduction
    const wallet = await Wallet.findOne({ user: student }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Wallet not found" });
    }

    const slotPrice = timeSlotDoc.price; // Ensure your timeSlot schema includes `price`
    if (wallet.balance < slotPrice) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    wallet.balance -= slotPrice;
    await wallet.save({ session });

    // 🔻 NEW: Create debit transaction
    await Transaction.create([{
      wallet: wallet._id,
      user: student,
      type: "debit",
      amount: slotPrice,
      description: `Seat booking for time slot ${timeSlotDoc.startTime} - ${timeSlotDoc.endTime}`
    }], { session });

    // Generate QR Code
    const qrCode = generateQRCode({
      _id: new mongoose.Types.ObjectId(),
      student,
      library,
      seat,
      timeSlot,
      startDate,
      endDate
    });

    if (!qrCode) {
      await session.abortTransaction();
      return res.status(500).json({ message: "Failed to generate QR code" });
    }

    // Create reservation
    const reservation = new Reservation({
      student,
      library,
      seat,
      timeSlot: {
        _id: timeSlot,
        startTime: timeSlotDoc.startTime,
        endTime: timeSlotDoc.endTime
      },
      startDate,
      endDate,
      qrCode,
      status: "active"
    });

    // Book the time slot
    await updateTimeSlotBooking(seat, timeSlot, student, true, session);

    await reservation.save({ session });

    await session.commitTransaction();

    const populatedReservation = await Reservation.findById(reservation._id)
      .populate('student', 'name email')
      .populate('library', 'name location')
      .populate('seat', 'seatNumber seatName')
      .lean();

    res.status(201).json({
      ...populatedReservation,
      message: "Reservation created successfully"
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Reservation creation error:", error);
    res.status(500).json({ message: "Failed to create reservation", error: error.message });
  } finally {
    session.endSession();
  }
};

// Get all reservations with filtering options
export const getAllReservations = async (req, res) => {
  try {
    const { student, library, seat, upcoming, past, status, fromDate, toDate } = req.query;
    const filter = {};
    const now = new Date();

    // Build filter object
    if (student) filter.student = student;
    if (library) filter.library = library;
    if (seat) filter.seat = seat;
    if (status) filter.status = status;

    // Date filtering
    if (upcoming === 'true') {
      filter.startDate = { $gte: now };
    } else if (past === 'true') {
      filter.endDate = { $lt: now };
    }

    if (fromDate && toDate) {
      filter.startDate = { ...filter.startDate, $gte: new Date(fromDate) };
      filter.endDate = { ...filter.endDate, $lte: new Date(toDate) };
    } else if (fromDate) {
      filter.startDate = { ...filter.startDate, $gte: new Date(fromDate) };
    } else if (toDate) {
      filter.endDate = { ...filter.endDate, $lte: new Date(toDate) };
    }

    // Get reservations with minimal population for performance
    const reservations = await Reservation.find(filter)
      .populate('student', 'name email')
      .populate('library', 'name location')
      .populate('seat', 'seatNumber seatName')
      .sort({ startDate: 1 })
      .lean();

    // Generate QR codes only if needed
    if (req.query.includeQr === 'true') {
      await Promise.all(reservations.map(async (reservation) => {
        const resDoc = await Reservation.findById(reservation._id);
        await ensureQRCode(resDoc);
        reservation.qrCode = resDoc.qrCode;
      }));
    }

    res.status(200).json({
      count: reservations.length,
      reservations
    });

  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).json({ 
      message: "Failed to fetch reservations",
      error: error.message 
    });
  }
};

// Get reservation by ID
export const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    let reservation = await Reservation.findById(id)
      .populate('student', 'name email')
      .populate('library', 'name location')
      .populate('seat', 'seatNumber seatName');

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    // Ensure QR code exists if requested
    if (req.query.includeQr === 'true') {
      reservation = await ensureQRCode(reservation);
    }

    res.status(200).json(reservation);

  } catch (error) {
    console.error("Error fetching reservation:", error);
    res.status(500).json({ 
      message: "Failed to fetch reservation",
      error: error.message 
    });
  }
};

// Update reservation
export const updateReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    // Check if reservation exists
    const reservation = await Reservation.findById(id).session(session);
    if (!reservation) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Reservation not found" });
    }

    // Validate status transition
    if (updates.status && !isValidStatusTransition(reservation.status, updates.status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid status transition" });
    }

    // Validate dates if being updated
    if (updates.startDate || updates.endDate) {
      const startDate = updates.startDate || reservation.startDate;
      const endDate = updates.endDate || reservation.endDate;
      
      const dateValidation = validateReservationDates(startDate, endDate);
      if (!dateValidation.valid) {
        await session.abortTransaction();
        return res.status(400).json({ message: dateValidation.message });
      }
    }

    // Check for booking conflicts (excluding current reservation)
    const timeSlotId = updates.timeSlot || reservation.timeSlot._id;
    const seatId = updates.seat || reservation.seat;
    const startDate = updates.startDate || reservation.startDate;
    const endDate = updates.endDate || reservation.endDate;

    if (await hasBookingConflict(seatId, timeSlotId, startDate, endDate, id)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Time slot is already booked for the selected date range" });
    }

    // If seat is being updated, check if new seat exists and is active
    if (updates.seat) {
      const seatExists = await Seat.findById(updates.seat).session(session);
      if (!seatExists) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Seat not found" });
      }
      if (!seatExists.isActive) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Seat is not active" });
      }
    }

    // If time slot is being updated, verify it exists in the seat
    if (updates.timeSlot) {
      const seatDoc = await Seat.findById(updates.seat || reservation.seat).session(session);
      const timeSlotDoc = seatDoc.timeSlots.id(updates.timeSlot);
      if (!timeSlotDoc) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Specified time slot not available for this seat" });
      }
      updates.timeSlot = {
        _id: timeSlotDoc._id,
        startTime: timeSlotDoc.startTime,
        endTime: timeSlotDoc.endTime
      };
    }

    // Handle time slot changes
    if (updates.timeSlot || updates.seat) {
      // Release old time slot
      await updateTimeSlotBooking(
        reservation.seat, 
        reservation.timeSlot._id, 
        reservation.student, 
        false
      );

      // Book new time slot
      await updateTimeSlotBooking(
        updates.seat || reservation.seat,
        updates.timeSlot?._id || reservation.timeSlot._id,
        reservation.student,
        true
      );
    }

    // Update reservation
    const updatedReservation = await Reservation.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, runValidators: true, session }
    )
      .populate('student', 'name email')
      .populate('library', 'name location')
      .populate('seat', 'seatNumber seatName');

    // Regenerate QR code if important fields were updated
    if (updates.student || updates.seat || updates.library || 
        updates.startDate || updates.endDate || updates.timeSlot) {
      updatedReservation.qrCode = generateQRCode(updatedReservation);
      await updatedReservation.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      ...updatedReservation.toObject(),
      message: "Reservation updated successfully"
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating reservation:", error);
    res.status(500).json({ 
      message: "Failed to update reservation",
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Cancel reservation
export const cancelReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    const reservation = await Reservation.findById(id).session(session);
    if (!reservation) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Reservation not found" });
    }

    // Check if reservation can be cancelled
    if (reservation.status !== 'active') {
      await session.abortTransaction();
      return res.status(400).json({ 
        message: `Reservation cannot be cancelled from current status: ${reservation.status}`
      });
    }

    // Release the time slot
    await updateTimeSlotBooking(
      reservation.seat, 
      reservation.timeSlot._id, 
      reservation.student, 
      false
    );

    // Update reservation status
    reservation.status = 'cancelled';
    reservation.cancellationReason = cancellationReason;
    await reservation.save({ session });

    await session.commitTransaction();

    res.status(200).json({ 
      message: "Reservation cancelled successfully",
      reservationId: id
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error cancelling reservation:", error);
    res.status(500).json({ 
      message: "Failed to cancel reservation",
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Get reservations by student
export const getReservationsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { upcoming, past, status, limit = 10, page = 1 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const filter = { student: studentId };
    const now = new Date();

    if (status) filter.status = status;
    if (upcoming === 'true') {
      filter.startDate = { $gte: now };
    } else if (past === 'true') {
      filter.endDate = { $lt: now };
    }

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { startDate: 1 }
    };

    const [reservations, total] = await Promise.all([
      Reservation.find(filter, null, options)
        .populate('library', 'name location')
        .populate('seat', 'seatNumber seatName')
        .lean(),
      Reservation.countDocuments(filter)
    ]);

    // Generate QR codes only if needed
    if (req.query.includeQr === 'true') {
      await Promise.all(reservations.map(async (reservation) => {
        const resDoc = await Reservation.findById(reservation._id);
        await ensureQRCode(resDoc);
        reservation.qrCode = resDoc.qrCode;
      }));
    }

    res.status(200).json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      reservations
    });

  } catch (error) {
    console.error("Error fetching student reservations:", error);
    res.status(500).json({ 
      message: "Failed to fetch student reservations",
      error: error.message 
    });
  }
};

// Get reservations by seat
export const getReservationsBySeat = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { date, status, limit = 10, page = 1 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      return res.status(400).json({ message: "Invalid seat ID" });
    }

    const filter = { seat: seatId };
    if (status) filter.status = status;
    
    if (date) {
      const selectedDate = new Date(date);
      filter.startDate = { $lte: selectedDate };
      filter.endDate = { $gte: selectedDate };
    }

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { startDate: 1 }
    };

    const [reservations, total] = await Promise.all([
      Reservation.find(filter, null, options)
        .populate('student', 'name email')
        .lean(),
      Reservation.countDocuments(filter)
    ]);

    res.status(200).json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      reservations
    });

  } catch (error) {
    console.error("Error fetching seat reservations:", error);
    res.status(500).json({ 
      message: "Failed to fetch seat reservations",
      error: error.message 
    });
  }
};

// Get current reservations (active now)
export const getCurrentReservations = async (req, res) => {
  try {
    const now = new Date();
    const filter = {
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: "active"
    };

    const reservations = await Reservation.find(filter)
      .populate('student', 'name email')
      .populate('library', 'name location')
      .populate('seat', 'seatNumber seatName')
      .lean();

    res.status(200).json({
      count: reservations.length,
      reservations
    });

  } catch (error) {
    console.error("Error fetching current reservations:", error);
    res.status(500).json({ 
      message: "Failed to fetch current reservations",
      error: error.message 
    });
  }
};

// Get QR code image for a reservation
export const getReservationQRCodeImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    let reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    // Ensure QR code exists
    reservation = await ensureQRCode(reservation);
    if (!reservation.qrCode) {
      return res.status(500).json({ message: "Failed to generate QR code" });
    }

    // Convert base64 to buffer
    const imgBuffer = Buffer.from(reservation.qrCode, 'base64');
    
    // Set content type and send image
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imgBuffer.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    res.end(imgBuffer);

  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ 
      message: "Failed to generate QR code",
      error: error.message 
    });
  }
};

// Helper function to validate status transitions
const isValidStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    'active': ['cancelled', 'completed', 'no-show'],
    'cancelled': [],
    'completed': [],
    'no-show': []
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

