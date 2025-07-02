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
      .populate('library')
      .sort({ seatNumber: 1 });

    res.status(200).json(seats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};