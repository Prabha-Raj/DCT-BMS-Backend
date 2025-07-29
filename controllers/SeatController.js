import mongoose from "mongoose";
import Seat from "../model/Seat.js";
import Booking from "../model/Booking.js";
import TimeSlot from "../model/TimeSlot.js";

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

    const seat = await Seat.findById(id).populate('library');

    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    res.status(200).json(seat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSeatDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // Optional date filter

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid seat ID" });
    }

    // Find the seat with basic details
    const seat = await Seat.findById(id).lean();
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    // Find all time slots associated with this seat (include seats array)
    const timeSlots = await TimeSlot.find({ seats: id })
      .select('startTime endTime price isActive seats')
      .sort({ startTime: 1 })
      .lean();

    // Prepare the query for bookings
    const bookingQuery = { 
      seat: id,
      status: { $nin: ['cancelled', 'rejected'] } // Exclude cancelled/rejected bookings
    };

    // Add date filter if provided
    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      
      bookingQuery.bookingDate = { $gte: startDate, $lte: endDate };
    }

    // Get all bookings for this seat in one query
    const allBookings = await Booking.find(bookingQuery)
      .populate('user', 'name email')
      .populate('timeSlot', 'startTime endTime price')
      .sort({ bookingDate: 1, 'timeSlot.startTime': 1 })
      .lean();

    // Group bookings by time slot
    const timeSlotsWithBookings = timeSlots.map(timeSlot => {
      const bookings = allBookings.filter(
        booking => booking.timeSlot._id.toString() === timeSlot._id.toString()
      );

      return {
        timeSlot: {
          _id: timeSlot._id,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          price: timeSlot.price,
          isActive: timeSlot.isActive,
          available: !bookings.some(b => b.status === 'confirmed') // Check if slot is available
        },
        bookings: bookings.map(booking => ({
          _id: booking._id,
          bookingDate: booking.bookingDate,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          user: booking.user,
          createdAt: booking.createdAt
        })),
        totalBookings: bookings.length,
        // Calculate available seats by checking how many seats are in this time slot
        // minus the number of confirmed bookings
        availableSeats: timeSlot.seats ? 
          timeSlot.seats.length - bookings.filter(b => b.status === 'confirmed').length :
          0
      };
    });

    // Prepare the response
    const seatDetails = {
      seat: {
        _id: seat._id,
        seatNumber: seat.seatNumber,
        seatName: seat.seatName,
        isActive: seat.isActive,
        library: seat.library
      },
      timeSlots: timeSlotsWithBookings,
      meta: {
        totalTimeSlots: timeSlotsWithBookings.length,
        totalBookings: allBookings.length,
        dateFilter: date || 'all dates'
      }
    };

    res.status(200).json(seatDetails);
  } catch (error) {
    console.error('Error in getSeatDetails:', error);
    res.status(500).json({ 
      message: "Failed to fetch seat details",
      error: error.message 
    });
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
    }).populate('library');

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
      .sort({ seatNumber: 1 });

    res.status(200).json(seats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addTimeSlotsForASeat = async (req, res) => {
  try {
    const { id: seatId } = req.params;
    const { libraryId, timeSlots } = req.body;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(seatId) || !mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({ message: "Invalid seat or library ID" });
    }

    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({ message: "Time slots array is required" });
    }

    // Check if seat exists and belongs to the library
    const seat = await Seat.findOne({ _id: seatId, library: libraryId });
    if (!seat) {
      return res.status(404).json({ message: "Seat not found in the specified library" });
    }

    // Process each time slot
    const createdTimeSlots = [];
    const errors = [];

    for (const slot of timeSlots) {
      try {
        // Check for existing time slot with same details
        const existingSlot = await TimeSlot.findOne({
          library: libraryId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: slot.price
        });

        if (existingSlot) {
          // If time slot exists, check if seat is already assigned
          if (existingSlot.seats.includes(seatId)) {
            errors.push({
              timeSlot: slot,
              error: "Seat already assigned to this time slot"
            });
            continue;
          }

          // Add seat to existing time slot
          existingSlot.seats.push(seatId);
          await existingSlot.save();
          createdTimeSlots.push(existingSlot);
        } else {
          // Create new time slot
          const newTimeSlot = new TimeSlot({
            library: libraryId,
            seats: [seatId],
            startTime: slot.startTime,
            endTime: slot.endTime,
            price: slot.price,
            isActive: true
          });

          await newTimeSlot.save();
          createdTimeSlots.push(newTimeSlot);
        }
      } catch (error) {
        errors.push({
          timeSlot: slot,
          error: error.message
        });
      }
    }

    if (createdTimeSlots.length === 0 && errors.length > 0) {
      return res.status(400).json({
        message: "Failed to create any time slots",
        errors: errors
      });
    }

    res.status(201).json({
      message: "Time slots processed successfully",
      createdTimeSlots: createdTimeSlots,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error in addTimeSlotsForASeat:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};