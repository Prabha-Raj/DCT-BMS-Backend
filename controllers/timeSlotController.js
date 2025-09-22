import mongoose from "mongoose";
import TimeSlot from "../model/TimeSlot.js";
import { isValidTime, compareTimes } from "../utils/timeUtils.js";
import Library from "../model/LibraryModel.js";
import Seat from "../model/Seat.js"; // Import Seat model if needed

// Create a new time slot (librarian only)
export const createTimeSlot = async (req, res) => {
  try {
    const {slotTitle, startTime, endTime, price, seats, slotType } = req.body;
    
    // Validate inputs
    if (!slotTitle || !startTime || !endTime || !price || !slotType) {
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
    
    const library = await Library.findOne({ librarian: req.user._id });

    // Create new time slot
    const timeSlot = new TimeSlot({
      library: library._id, 
      slotTitle,
      startTime,
      endTime,
      price,
      seats: seats || [], // Initialize seats array
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      slotType
    });

    await timeSlot.save();

    res.status(201).json({
      success: true,
      message: "Time slot added Successfully!",
      timeSlot
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add seats to a time slot
export const addSeatsToTimeSlot = async (req, res) => {
  try {
    const { seatIds } = req.body; // Expecting an array of seat IDs
    const { timeSlotId } = req.params;

    if (!seatIds || !Array.isArray(seatIds)) {
      return res.status(400).json({
        success: false,
        message: "seatIds must be an array of seat IDs"
      });
    }

    const timeSlot = await TimeSlot.findById(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: "TimeSlot not found || Invalid TimeSlot id!"
      });
    }

    // Validate all seat IDs
    const invalidSeatIds = seatIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidSeatIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid seat IDs: ${invalidSeatIds.join(', ')}`
      });
    }

    // Add new seats (avoid duplicates)
    const newSeats = seatIds.filter(seatId => 
      !timeSlot.seats.includes(seatId)
    );
    timeSlot.seats = [...timeSlot.seats, ...newSeats];

    await timeSlot.save();

    res.status(200).json({
      success: true,
      message: "Seats added to time slot successfully!",
      timeSlot
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove seats from a time slot
export const removeSeatsFromTimeSlot = async (req, res) => {
  try {
    const { seatIds } = req.body; // Expecting an array of seat IDs
    const { timeSlotId } = req.params;

    if (!seatIds || !Array.isArray(seatIds)) {
      return res.status(400).json({
        success: false,
        message: "seatIds must be an array of seat IDs"
      });
    }

    const timeSlot = await TimeSlot.findById(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: "TimeSlot not found || Invalid TimeSlot id!"
      });
    }

    // Filter out the seats to be removed
    timeSlot.seats = timeSlot.seats.filter(seatId => 
      !seatIds.includes(seatId.toString())
    );

    await timeSlot.save();

    res.status(200).json({
      success: true,
      message: "Seats removed from time slot successfully!",
      timeSlot
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all time slots (Public)
export const getAllTimeSlots = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const filter = {};

    if (activeOnly === 'true') {
      filter.isActive = true;
    }

    const timeSlots = await TimeSlot.find(filter)
      .populate('seats') // Optionally populate seats
      .sort({ startTime: 1 });

    res.status(200).json(timeSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getAllTimeSlotsByLibrary = async (req, res) => {
  // console.log("done")
  try {
    const { libraryId } = req.params;
    const { activeOnly } = req.query;
    const filter = {};
    if(!libraryId || !mongoose.Types.ObjectId.isValid(libraryId)){
      res.status(400).json({
        success:false,
        message:"Invalid library Id!"
      })
    }

    filter.library = libraryId

    if (activeOnly === 'true') {
      filter.isActive = true;
    }

    const timeSlots = await TimeSlot.find(filter)
      .populate('seats') // Optionally populate seats
      .sort({ startTime: 1 });

    res.status(200).json(timeSlots);
  } catch (error) {
    res.status(500).json({ 
      success:false,
      message: error.message
     });
  }
};

// Get time slot by ID (Public)
export const getTimeSlotById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid time slot ID" });
    }

    const timeSlot = await TimeSlot.findById(id).populate('seats'); // Optionally populate seats

    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    res.status(200).json(timeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a time slot (librarian only)
export const updateTimeSlot = async (req, res) => {
  console.log('hii')
  try {
    const { id } = req.params;
    const {slotTitle, startTime, endTime, price, slotType, isActive, seats } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid timeslot ID" });
    }

    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found || invalid time slot id" });
    }

    // Validate updates
    if (startTime && !isValidTime(startTime)) {
      return res.status(400).json({ message: "Invalid start time format" });
    }

    if (endTime && !isValidTime(endTime)) {
      return res.status(400).json({ message: "Invalid end time format" });
    }

    if (startTime && endTime && compareTimes(startTime, endTime) >= 0) {
      return res.status(400).json({ message: "startTime must be before endTime" });
    }

    if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) <= 0)) {
      return res.status(400).json({ message: "Price must be a positive number" });
    }

    if (seats && !Array.isArray(seats)) {
      return res.status(400).json({ message: "Seats must be an array" });
    }
    // Apply updates
    if (slotTitle) timeSlot.slotTitle = slotTitle;
    if (startTime) timeSlot.startTime = startTime;
    if (endTime) timeSlot.endTime = endTime;
    if (slotType) timeSlot.slotType = slotType;
    if (price !== undefined) timeSlot.price = price;
    if (isActive !== undefined) timeSlot.isActive = isActive;
    if (seats) {
      // Validate all seat IDs
      const invalidSeatIds = seats.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidSeatIds.length > 0) {
        return res.status(400).json({
          message: `Invalid seat IDs: ${invalidSeatIds.join(', ')}`
        });
      }
      timeSlot.seats = seats;
    }
    
    await timeSlot.save();

    res.status(200).json({
      success: true,
      message: "Time slot updated successfully!",
      timeSlot
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Toggle time slot active status (librarian only)
export const toggleTimeSlotStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid time slot ID" });
    }

    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    timeSlot.isActive = !timeSlot.isActive;
    await timeSlot.save();

    res.status(200).json(timeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a time slot (librarian only)
export const deleteTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid time slot ID" });
    }

    const timeSlot = await TimeSlot.findByIdAndDelete(id);

    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    res.status(200).json({ message: "Time slot deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};