import mongoose from "mongoose";
import moment from "moment";
import Attendance from "../model/Attendance.js";
import MonthlyBookingAttendance from "../model/MonthlyBookingAttendance.js";
import MonthlyBooking from "../model/MonthlyBooking.js";
import Booking from "../model/Booking.js";

// Helper function to check if current time is within a time slot
const isWithinTimeSlot = (timeSlot, currentTime) => {
  if (!timeSlot || !timeSlot.startTime || !timeSlot.endTime) return false;

  const currentMoment = moment(currentTime);
  const startMoment = moment(timeSlot.startTime, "HH:mm");
  const endMoment = moment(timeSlot.endTime, "HH:mm");

  return currentMoment.isBetween(startMoment, endMoment, null, '[]');
};

// Unified check-in/check-out controller
export const handleCheckInOut = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { action } = req.body; // 'checkin' or 'checkout'
    const studentId = req.user._id;
    const method = "QR";
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Validate library ID
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid library ID"
      });
    }

    // Validate action parameter
    if (!action || (action !== 'checkin' && action !== 'checkout')) {
      return res.status(400).json({
        success: false,
        message: "Action parameter is required and must be either 'checkin' or 'checkout'"
      });
    }

    // Check for active monthly booking first
    const monthlyBooking = await MonthlyBooking.findOne({
      user: studentId,
      library: libraryId,
      status: "confirmed",
      paymentStatus: "paid",
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    if (monthlyBooking) {
      // Handle monthly booking check-in/out
      let attendance = await MonthlyBookingAttendance.findOne({
        student: studentId,
        library: libraryId,
        booking: monthlyBooking._id,
        date: today
      });

      if (action === 'checkin') {
        if (!attendance) {
          // Check-in for monthly booking
          attendance = new MonthlyBookingAttendance({
            student: studentId,
            library: libraryId,
            booking: monthlyBooking._id,
            date: today,
            method,
            sessions: [{
              checkInTime: now
            }]
          });

          await attendance.save();

          const populatedAttendance = await MonthlyBookingAttendance.findById(attendance._id)
            .populate("student", "name email")
            .populate("library", "name")
            .populate("booking", "startDate endDate");

          return res.status(200).json({
            success: true,
            message: "Monthly booking checked in successfully",
            type: "monthly",
            data: populatedAttendance,
            action: "checkin"
          });
        } else {
          // Check if there's an active session
          const activeSessionIndex = attendance.sessions.findIndex(session => !session.checkOutTime);

          if (activeSessionIndex === -1) {
            // No active session, create new check-in
            attendance.sessions.push({
              checkInTime: now
            });

            await attendance.save();

            const populatedAttendance = await MonthlyBookingAttendance.findById(attendance._id)
              .populate("student", "name email")
              .populate("library", "name")
              .populate("booking", "startDate endDate");

            return res.status(200).json({
              success: true,
              message: "Checked in successfully in Currect Monthly booking",
              type: "monthly",
              data: populatedAttendance,
              action: "checkin"
            });
          } else {
            return res.status(400).json({
              success: false,
              message: "You already have an active session. Please check out first.",
              action: "checkout_required"
            });
          }
        }
      } else if (action === 'checkout') {
        if (!attendance) {
          return res.status(400).json({
            success: false,
            message: "No check-in found for today. Please check in first.",
            action: "checkin_required"
          });
        }

        // Check if there's an active session to check out
        const activeSessionIndex = attendance.sessions.findIndex(session => !session.checkOutTime);

        if (activeSessionIndex === -1) {
          return res.status(400).json({
            success: false,
            message: "No active session found. Please check in first.",
            action: "checkin_required"
          });
        } else {
          // Active session found, perform check-out
          const session = attendance.sessions[activeSessionIndex];
          session.checkOutTime = now;
          session.durationMinutes = Math.floor((now - session.checkInTime) / (1000 * 60));

          attendance.markModified('sessions');
          await attendance.save();

          const populatedAttendance = await MonthlyBookingAttendance.findById(attendance._id)
            .populate("student", "name email")
            .populate("library", "name")
            .populate("booking", "startDate endDate");

          return res.status(200).json({
            success: true,
            message: "Checked out successfully in Currect Monthly booking",
            type: "monthly",
            data: populatedAttendance,
            action: "checkout"
          });
        }
      }
    }

    // If no monthly booking, check for daily time slot booking
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Different find conditions for checkin vs checkout
    let findConditions = {
      user: studentId,
      library: libraryId,
      bookingDate: { $gte: todayStart, $lt: todayEnd },
      paymentStatus: "paid"
    };

    if (action === 'checkin') {
        findConditions.status = { $in: ["confirmed", "checked-in"] };
    } else if (action === 'checkout') {
      findConditions.status = "checked-in";
    }

    const dailyBooking = await Booking.findOne(findConditions).populate("timeSlot");

    if (!dailyBooking) {
      const message = action === 'checkin'
        ? "No confirmed booking found for today"
        : "No active check-in found for today";

      return res.status(400).json({
        success: false,
        message: message
      });
    }

    // Check if current time is within the booked time slot (for check-in only)
    if (action === 'checkin' && !isWithinTimeSlot(dailyBooking.timeSlot, now)) {
      return res.status(400).json({
        success: false,
        message: `Check-in is only allowed between ${dailyBooking.timeSlot.startTime} and ${dailyBooking.timeSlot.endTime}`,
        bookingTimeSlot: {
          start: dailyBooking.timeSlot.startTime,
          end: dailyBooking.timeSlot.endTime
        },
        currentTime: moment().format('HH:mm')
      });
    }

    // Check for existing attendance for this daily booking
    let attendance = await Attendance.findOne({
      student: studentId,
      library: libraryId,
      booking: dailyBooking._id,
      checkInTime: { $gte: todayStart, $lt: todayEnd }
    });

    if (action === 'checkin') {
      if (!attendance) {
        // Check-in for daily booking
        attendance = new Attendance({
          student: studentId,
          library: libraryId,
          checkInTime: now,
          method,
          booking: dailyBooking._id,
          timeSlot: dailyBooking.timeSlot._id
        });

        await attendance.save();

        // ✅ UPDATE: Change booking status to "checked-in"
        await Booking.findByIdAndUpdate(
          dailyBooking._id,
          { status: "checked-in" },
          { new: true }
        );

        const populatedAttendance = await Attendance.findById(attendance._id)
          .populate("student", "name email")
          .populate("library", "name")
          .populate("booking", "bookingDate")
          .populate("timeSlot", "startTime endTime");

        return res.status(200).json({
          success: true,
          message: "Checked in successfully in Daily / OneTime booking",
          type: "daily",
          data: populatedAttendance,
          action: "checkin"
        });
      } else if (!attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message: "You already have an active check-in. Please check out first.",
          action: "checkout_required"
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Already checked out for today. Cannot check in again.",
          action: "already_checked_out"
        });
      }
    } else if (action === 'checkout') {
      if (!attendance) {
        return res.status(400).json({
          success: false,
          message: "No check-in found for today. Please check in first.",
          action: "checkin_required"
        });
      } else if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message: "Already checked out for today.",
          action: "already_checked_out"
        });
      } else {
        // Check-out for daily booking
        attendance.checkOutTime = now;
        attendance.durationMinutes = Math.floor((now - attendance.checkInTime) / (1000 * 60));
        await attendance.save();

        // ✅ UPDATE: Change booking status to "completed"
        await Booking.findByIdAndUpdate(
          dailyBooking._id,
          { status: "completed" },
          { new: true }
        );

        const populatedAttendance = await Attendance.findById(attendance._id)
          .populate("student", "name email")
          .populate("library", "name")
          .populate("booking", "bookingDate")
          .populate("timeSlot", "startTime endTime");

        return res.status(200).json({
          success: true,
          message: "Checked-out successfully in Daily / OneTime booking",
          type: "daily",
          data: populatedAttendance,
          action: "checkout"
        });
      }
    }

  } catch (error) {
    console.error("Check-in/out error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get current check-in status
export const getCheckInStatus = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const studentId = req.user._id;
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Check monthly booking status
    const monthlyBooking = await MonthlyBooking.findOne({
      user: studentId,
      library: libraryId,
      status: "confirmed",
      paymentStatus: "paid",
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    if (monthlyBooking) {
      const attendance = await MonthlyBookingAttendance.findOne({
        student: studentId,
        library: libraryId,
        booking: monthlyBooking._id,
        date: today
      });

      const activeSession = attendance?.sessions?.find(session => !session.checkOutTime);

      return res.status(200).json({
        success: true,
        type: "monthly",
        isCheckedIn: !!activeSession,
        canCheckIn: !activeSession,
        canCheckOut: !!activeSession,
        data: attendance,
        activeSession: activeSession || null,
        booking: monthlyBooking
      });
    }

    // Check daily booking status
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const dailyBooking = await Booking.findOne({
      user: studentId,
      library: libraryId,
      bookingDate: { $gte: todayStart, $lt: todayEnd },
      status: "confirmed",
      paymentStatus: "paid"
    }).populate("timeSlot");

    if (dailyBooking) {
      const attendance = await Attendance.findOne({
        student: studentId,
        library: libraryId,
        booking: dailyBooking._id,
        checkInTime: { $gte: todayStart, $lt: todayEnd }
      });

      const isCheckedIn = !!attendance && !attendance.checkOutTime;
      const canCheckIn = !attendance || (attendance && attendance.checkOutTime);
      const canCheckOut = !!attendance && !attendance.checkOutTime;

      // Check if current time is within the booked time slot
      const isWithinSlot = isWithinTimeSlot(dailyBooking.timeSlot, now);
      const canCheckInNow = canCheckIn && isWithinSlot;

      return res.status(200).json({
        success: true,
        type: "daily",
        isCheckedIn,
        canCheckIn: canCheckInNow,
        canCheckOut,
        isWithinTimeSlot: isWithinSlot,
        data: attendance,
        booking: dailyBooking,
        timeSlot: dailyBooking.timeSlot
      });
    }

    return res.status(200).json({
      success: true,
      type: "none",
      isCheckedIn: false,
      canCheckIn: false,
      canCheckOut: false,
      message: "No active booking found"
    });

  } catch (error) {
    console.error("Get check-in status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};