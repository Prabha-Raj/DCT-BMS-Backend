import mongoose from "mongoose";
import Seat from "../model/Seat.js";

// Helper functions for time validation
const isValidTime = (time) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
const compareTimes = (a, b) => a.localeCompare(b);

// Create a new seat
export const createSeat = async (req, res) => {
  try {
    const { library, seatNumber, seatName } = req.body;

    // Check if seat already exists by number or name
    const existingSeat = await Seat.findOne({
      library,
      $or: [
        { seatNumber },
        { seatName }
      ]
    });

    if (existingSeat) {
      if (existingSeat.seatNumber === seatNumber) {
        return res.status(400).json({ message: `Seat No. ${seatNumber} already exists in this library` });
      }
      if (existingSeat.seatName === seatName) {
        return res.status(400).json({ message: `Seat Name ${seatName} already exists in this library` });
      }
    }

    const seat = new Seat(req.body);
    await seat.save();

    res.status(201).json(seat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk create seats
export const bulkCreateSeats = async (req, res) => {
  try {
    const { library, seats } = req.body;

    if (!library || !seats || !Array.isArray(seats)) {
      return res.status(400).json({ message: "Library and seats array are required" });
    }

    const seatNumbers = seats.map(s => s.seatNumber);
    const seatNames = seats.map(s => s.seatName).filter(name => name);

    const existingSeats = await Seat.find({
      library,
      $or: [
        { seatNumber: { $in: seatNumbers } },
        { seatName: { $in: seatNames } }
      ]
    });

    if (existingSeats.length > 0) {
      const existingNumbers = existingSeats.map(s => s.seatNumber);
      const existingNames = existingSeats.map(s => s.seatName);
      return res.status(400).json({
        message: "Some seat numbers or names already exist",
        conflicts: {
          seatNumbers: existingNumbers,
          seatNames: existingNames
        }
      });
    }

    const seatsToCreate = seats.map(seat => ({
      library,
      seatNumber: seat.seatNumber,
      seatName: seat.seatName || undefined,
      isActive: seat.isActive !== undefined ? seat.isActive : true
    }));

    const createdSeats = await Seat.insertMany(seatsToCreate);
    res.status(201).json(createdSeats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all seats
export const getAllSeats = async (req, res) => {
  try {
    const { library, isActive, search } = req.query;
    const filter = {};

    if (library) filter.library = library;
    if (isActive !== undefined) filter.isActive = isActive;

    if (search) {
      filter.$or = [
        { seatNumber: { $regex: search, $options: 'i' } },
        { seatName: { $regex: search, $options: 'i' } }
      ];
    }

    const seats = await Seat.find(filter)
      .populate('library')
      .populate('timeSlots.bookings.user', "-password")
      .sort({ seatNumber: 1 });

    res.status(200).json(seats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get seat by ID
export const getSeatById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid seat ID" });
    }

    const seat = await Seat.findById(id)
      .populate('library')
      .populate('timeSlots.bookings.user', "-password");

    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    res.status(200).json(seat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update seat
export const updateSeat = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid seat ID" });
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    // Check if updating would create a duplicate
    if (updates?.library || updates?.seatNumber || updates?.seatName) {
      const library = updates.library || seat.library;
      const seatNumber = updates.seatNumber || seat.seatNumber;
      const seatName = updates.seatName || seat.seatName;

      const existingSeat = await Seat.findOne({
        library,
        $or: [
          { seatNumber: seatNumber },
          { seatName: seatName }
        ],
        _id: { $ne: id }
      });

      if (existingSeat) {
        if (existingSeat.seatNumber === seatNumber) {
          return res.status(400).json({ message: "Another seat already exists with this number in the library" });
        }
        if (existingSeat.seatName === seatName) {
          return res.status(400).json({ message: "Another seat already exists with this name in the library" });
        }
      }
    }

    const updatedSeat = await Seat.findByIdAndUpdate(id, updates, { 
      new: true,
      runValidators: true 
    })
      .populate('library')
      .populate('timeSlots.bookings.user', "-password");

    res.status(200).json(updatedSeat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle seat active status
export const toggleSeatStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid seat ID" });
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    seat.isActive = !seat.isActive;
    await seat.save();

    res.status(200).json(seat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete seat
export const deleteSeat = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid seat ID" });
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    // Check if there are any active bookings
    const hasActiveBookings = seat.timeSlots.some(slot => 
      slot.bookings.some(b => b.isActive)
    );
    
    if (hasActiveBookings) {
      return res.status(400).json({ 
        message: "Cannot delete seat with active bookings" 
      });
    }

    await Seat.findByIdAndDelete(id);
    res.status(200).json({ message: "Seat deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get seats by library
export const getSeatsByLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { isActive, search } = req.query;

    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({ message: "Invalid library ID" });
    }

    const filter = { library: libraryId };
    if (isActive !== undefined) filter.isActive = isActive;

    if (search) {
      filter.$or = [
        { seatNumber: { $regex: search, $options: 'i' } },
        { seatName: { $regex: search, $options: 'i' } }
      ];
    }

    const seats = await Seat.find(filter)
      .populate('library')
      .populate('timeSlots.bookings.user', "-password")
      .sort({ seatNumber: 1 });

    res.status(200).json(seats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Time Slot Management Controllers


// Add time slots to a seat
export const addTimeSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { timeSlots } = req.body;

    if (!Array.isArray(timeSlots)) {
      return res.status(400).json({ message: "Time slots must be provided as an array" });
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    // Validate time slots
    const validatedSlots = timeSlots.map(slot => {
      if (!slot.startTime || !slot.endTime || !slot.price) {
        throw new Error("Each time slot must have startTime, endTime, and price");
      }
      if (!isValidTime(slot.startTime) || !isValidTime(slot.endTime)) {
        throw new Error("Time must be in HH:MM format");
      }
      if (compareTimes(slot.startTime, slot.endTime) >= 0) {
        throw new Error("startTime must be before endTime");
      }
      if (isNaN(parseFloat(slot.price)) || parseFloat(slot.price) <= 0) {
        throw new Error("Price must be a positive number");
      }
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        price: slot.price,
        bookings: [],
        isBooked: false
      };
    });

    seat.timeSlots.push(...validatedSlots);
    await seat.save();

    res.status(201).json({
      message: "Time slots added successfully",
      timeSlots: validatedSlots
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a time slot
export const updateTimeSlot = async (req, res) => {
  try {
    const { id, slotId } = req.params;
    const { startTime, endTime, price } = req.body;

    if (!startTime || !endTime || !price) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ message: "Time must be in HH:MM format" });
    }

    if (compareTimes(startTime, endTime) >= 0) {
      return res.status(400).json({ message: "startTime must be before endTime" });
    }

    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({ message: "Price must be a positive number" });
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    // Check if the slot is booked
    if (slot.isBooked) {
      return res.status(400).json({ message: "Cannot modify a booked time slot" });
    }

    // Check for overlapping with other slots (excluding current slot)
    const hasOverlap = seat.timeSlots.some(existingSlot => {
      if (existingSlot._id.equals(slot._id)) return false;
      return (
        (startTime >= existingSlot.startTime && startTime < existingSlot.endTime) ||
        (endTime > existingSlot.startTime && endTime <= existingSlot.endTime) ||
        (startTime <= existingSlot.startTime && endTime >= existingSlot.endTime)
      );
    });

    if (hasOverlap) {
      return res.status(400).json({ message: "Time slot overlaps with existing slots" });
    }

    slot.startTime = startTime;
    slot.endTime = endTime;
    slot.price = price;

    await seat.save();

    res.status(200).json({
      message: "Time slot updated successfully",
      timeSlot: slot
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const toggleTimeSlotActive = async (req, res) => {
  try {
    const { id, slotId } = req.params;

    // Find the seat
    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    // Find the specific time slot
    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    // Toggle isActive status
    slot.isActive = !slot.isActive;

    // Save the updated seat
    await seat.save();

    res.status(200).json({
      message: `Time slot is now ${slot.isActive ? "active" : "inactive"}`,
      updatedSlot: slot,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get time slots for a seat
export const getTimeSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { activeOnly } = req.query;

    const seat = await Seat.findById(id)
      .populate('timeSlots.bookings.user', '-password');

    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    let timeSlots = seat.timeSlots;

    // Filter by active status if requested
    if (activeOnly === 'true') {
      timeSlots = timeSlots.filter(slot => slot.isBooked);
    }

    res.status(200).json(timeSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Book a time slot
export const bookTimeSlot = async (req, res) => {
  try {
    const { id, slotId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    // Check if user already has an active booking
    const existingActive = slot.bookings.find(b => 
      b.user.equals(userId) && b.isActive
    );
    
    if (existingActive) {
      return res.status(400).json({ 
        message: "You already have an active booking for this slot" 
      });
    }

    // Add new booking
    slot.bookings.push({
      user: userId,
      isActive: true
    });

    // Update isBooked status
    slot.isBooked = slot.bookings.some(b => b.isActive);
    
    await seat.save();

    // Populate user data in response
    const populatedSeat = await Seat.findById(id)
      .populate('timeSlots.bookings.user', '-password');

    res.status(200).json({
      message: "Time slot booked successfully",
      timeSlot: populatedSeat.timeSlots.id(slotId)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get time slot bookings
export const getTimeSlotBookings = async (req, res) => {
  try {
    const { id, slotId } = req.params;
    const { activeOnly } = req.query;

    const seat = await Seat.findById(id)
      .populate('timeSlots.bookings.user', '-password');
      
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    let bookings = slot.bookings;
    
    if (activeOnly === 'true') {
      bookings = bookings.filter(b => b.isActive);
    }

    res.status(200).json({
      isBooked: slot.isBooked,
      bookings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update booking status
export const updateBookingStatus = async (req, res) => {
  try {
    const { id, slotId, bookingId } = req.params;
    const { isActive } = req.body;

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    const booking = slot.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.isActive = isActive;
    
    // Update slot's isBooked status
    slot.isBooked = slot.bookings.some(b => b.isActive);
    
    await seat.save();
    
    // Populate user data in response
    const populatedSeat = await Seat.findById(id)
      .populate('timeSlots.bookings.user', '-password');

    res.status(200).json({
      message: "Booking status updated",
      booking: populatedSeat.timeSlots.id(slotId).bookings.id(bookingId)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a time slot
export const deleteTimeSlot = async (req, res) => {
  try {
    const { id, slotId } = req.params;

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    // Check for active bookings
    if (slot.bookings.some(b => b.isActive)) {
      return res.status(400).json({ 
        message: "Cannot delete time slot with active bookings" 
      });
    }

    seat.timeSlots.pull(slotId);
    await seat.save();
    
    res.status(200).json({ message: "Time slot deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a booking
export const deleteBooking = async (req, res) => {
  try {
    const { id, slotId, bookingId } = req.params;

    const seat = await Seat.findById(id);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const slot = seat.timeSlots.id(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    const booking = slot.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.isActive) {
      return res.status(400).json({ 
        message: "Cannot delete active booking. Deactivate it first." 
      });
    }

    slot.bookings.pull(bookingId);
    
    // Update isBooked status if needed
    slot.isBooked = slot.bookings.some(b => b.isActive);
    
    await seat.save();
    
    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};