import mongoose from "mongoose";
import TimeSlot from "../model/TimeSlot.js";
import { isValidTime, compareTimes } from "../utils/timeUtils.js";

// Create a new time slot (Admin only)
export const createTimeSlot = async (req, res) => {
  try {
    const { startTime, endTime, price } = req.body;

    // Validate inputs
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

    // Create new time slot
    const timeSlot = new TimeSlot({
      startTime,
      endTime,
      price,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });

    await timeSlot.save();

    res.status(201).json(timeSlot);
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
      .sort({ startTime: 1 });

    res.status(200).json(timeSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get time slot by ID (Public)
export const getTimeSlotById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid time slot ID" });
    }

    const timeSlot = await TimeSlot.findById(id);

    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    res.status(200).json(timeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a time slot (Admin only)
export const updateTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, price, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid time slot ID" });
    }

    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
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

    // Apply updates
    if (startTime) timeSlot.startTime = startTime;
    if (endTime) timeSlot.endTime = endTime;
    if (price !== undefined) timeSlot.price = price;
    if (isActive !== undefined) timeSlot.isActive = isActive;

    await timeSlot.save();

    res.status(200).json(timeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle time slot active status (Admin only)
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

// Delete a time slot (Admin only)
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