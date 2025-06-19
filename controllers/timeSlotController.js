import Seat from "../model/Seat.js";


// Add single or multiple time slots to a seat
export const addTimeSlots = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { timeSlots } = req.body; // Array of { startTime, endTime }

    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({ message: "Please provide valid time slots data" });
    }

    // Validate each time slot
    for (const slot of timeSlots) {
      if (!slot.startTime || !slot.endTime) {
        return res.status(400).json({ message: "Each time slot must have startTime and endTime" });
      }
      if (new Date(slot.startTime) >= new Date(slot.endTime)) {
        return res.status(400).json({ message: "startTime must be before endTime" });
      }
    }

    const seat = await Seat.findById(seatId);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    // Add new time slots
    const newTimeSlots = timeSlots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime
    }));

    seat.timeSlots.push(...newTimeSlots);
    await seat.save();

    res.status(201).json({
      message: "Time slots added successfully",
      timeSlots: newTimeSlots
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Book a time slot
export const bookTimeSlot = async (req, res) => {
  try {
    const { seatId, timeSlotId } = req.params;
    const { userId } = req.body;

    const seat = await Seat.findById(seatId);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const timeSlot = seat.timeSlots.id(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    if (timeSlot.isBooked) {
      return res.status(400).json({ message: "Time slot is already booked" });
    }

    timeSlot.isBooked = true;
    timeSlot.bookedBy = userId;
    await seat.save();

    res.status(200).json({
      message: "Time slot booked successfully",
      timeSlot
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a time slot
export const updateTimeSlot = async (req, res) => {
  try {
    const { seatId, timeSlotId } = req.params;
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ message: "Please provide startTime and endTime" });
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ message: "startTime must be before endTime" });
    }

    const seat = await Seat.findById(seatId);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const timeSlot = seat.timeSlots.id(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    if (timeSlot.isBooked) {
      return res.status(400).json({ message: "Cannot update a booked time slot" });
    }

    timeSlot.startTime = startTime;
    timeSlot.endTime = endTime;
    await seat.save();

    res.status(200).json({
      message: "Time slot updated successfully",
      timeSlot
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a time slot
export const deleteTimeSlot = async (req, res) => {
  try {
    const { seatId, timeSlotId } = req.params;

    const seat = await Seat.findById(seatId);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    const timeSlot = seat.timeSlots.id(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({ message: "Time slot not found" });
    }

    if (timeSlot.isBooked) {
      return res.status(400).json({ message: "Cannot delete a booked time slot" });
    }

    seat.timeSlots.pull(timeSlotId);
    await seat.save();

    res.status(200).json({
      message: "Time slot deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all time slots for a seat
export const getTimeSlots = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { startDate, endDate, bookedOnly } = req.query;

    const seat = await Seat.findById(seatId);
    if (!seat) {
      return res.status(404).json({ message: "Seat not found" });
    }

    let timeSlots = seat.timeSlots;

    // Filter by date range if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      timeSlots = timeSlots.filter(slot => {
        const slotStart = new Date(slot.startTime);
        return slotStart >= start && slotStart <= end;
      });
    }

    // Filter by booked status if requested
    if (bookedOnly === 'true') {
      timeSlots = timeSlots.filter(slot => slot.isBooked);
    } else if (bookedOnly === 'false') {
      timeSlots = timeSlots.filter(slot => !slot.isBooked);
    }

    res.status(200).json({
      timeSlots
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};