import mongoose from "mongoose";
import moment from "moment";
import TimeSlot from "../model/TimeSlot.js";
import Booking from "../model/Booking.js";
import Attendance from "../model/Attendance.js";
import Library from "../model/LibraryModel.js";



// Helper function to check if current time is within booking time slot
const isWithinTimeSlot = async (timeSlotId, bookingDate) => {
  const timeSlot = await TimeSlot.findById(timeSlotId);
  if (!timeSlot) return false;

  // Convert bookingDate to local date
  const bookingMoment = moment(bookingDate);
  const bookingDay = bookingMoment.format('YYYY-MM-DD');
  
  const now = moment();
  
  // Create moment objects for the time slot on the booking day
  const startTime = moment(`${bookingDay} ${timeSlot.startTime}`, "YYYY-MM-DD HH:mm");
  const endTime = moment(`${bookingDay} ${timeSlot.endTime}`, "YYYY-MM-DD HH:mm");

  return now.isBetween(startTime, endTime);
};

// Updated Check-in controller with specific booking check-in verification
export const checkIn = async (req, res) => {
  try {
    const { libraryId, bookingId } = req.params;
    const method = "QR"; // Default to QR if method not specified
    const studentId = req.user?._id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid library ID"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    // Get current date range for today's bookings
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    // Find the specific booking
    const booking = await Booking.findOne({
      _id: bookingId,
      user: studentId,
      library: libraryId,
      bookingDate: {
        $gte: todayStart,
        $lt: todayEnd
      },
      status: "confirmed"
    }).populate("timeSlot");

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: "No valid booking found with the provided ID for today"
      });
    }

    // Check if current time is within the booked time slot
    const withinTimeSlot = await isWithinTimeSlot(booking.timeSlot._id, booking.bookingDate);
    if (!withinTimeSlot) {
      const timeSlot = booking.timeSlot;
      return res.status(400).json({
        success: false,
        message: `Check-in is only allowed between ${timeSlot.startTime} and ${timeSlot.endTime}`,
        bookingTimeSlot: {
          start: timeSlot.startTime,
          end: timeSlot.endTime
        },
        currentTime: moment().format('HH:mm')
      });
    }

    // Check if there's already a check-in for this specific booking (whether checked out or not)
    const existingAttendanceForBooking = await Attendance.findOne({
      booking: bookingId,
      checkInTime: { $gte: todayStart, $lt: todayEnd }
    });

    if (existingAttendanceForBooking) {
      return res.status(400).json({
        success: false,
        message: "A check-in already exists for this booking",
        existingAttendance: existingAttendanceForBooking,
        canCheckOut: !existingAttendanceForBooking.checkOutTime
      });
    }

    // Create new attendance record
    const attendance = new Attendance({
      student: studentId,
      library: libraryId,
      checkInTime: now,
      method,
      booking: booking._id,
      timeSlot: booking.timeSlot._id
    });

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Checked in successfully",
      data: attendance
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Updated Check-out controller with bookingId verification
export const checkOut = async (req, res) => {
  try {
    const { libraryId, bookingId } = req.params;
    const studentId = req.user?._id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid library ID"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    // Find today's check-in record for this specific booking
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    const attendance = await Attendance.findOne({
      student: studentId,
      library: libraryId,
      booking: bookingId,
      checkInTime: { $gte: todayStart, $lt: todayEnd },
      checkOutTime: { $exists: false }
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "No active check-in found for this booking today"
      });
    }

    // Calculate duration in minutes
    const durationMinutes = Math.floor((now - attendance.checkInTime) / (1000 * 60));
    
    // Update check-out time
    attendance.checkOutTime = now;
    attendance.durationMinutes = durationMinutes;
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Checked out successfully",
      data: attendance
    });
  } catch (error) {
    console.error("Check-out error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


// Get all attendances (for admin)
export const getAllAttendances = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, libraryId, method, studentId } = req.query;
    
    const query = {};
    
    if (startDate && endDate) {
      query.checkInTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (libraryId) {
      query.library = libraryId;
    }
    
    if (method) {
      query.method = method;
    }

    if (studentId) {
      query.student = studentId;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { checkInTime: -1 },
      populate: [
        { path: "student", select: "name email" },
        { path: "library", select: "name" },
        { path: "timeSlot", select: "startTime endTime" }
      ]
    };
    
    const attendances = await Attendance.paginate(query, options);
    
    // Calculate stats
    const stats = {
      total: attendances.totalDocs,
      qrCount: await Attendance.countDocuments({ ...query, method: "QR" }),
      manualCount: await Attendance.countDocuments({ ...query, method: "manual" }),
      avgDuration: await calculateAverageDuration(query),
      uniqueStudents: await getUniqueStudentsCount(query),
      uniqueLibraries: await getUniqueLibrariesCount(query)
    };
    
    return res.status(200).json({
      success: true,
      message: "Attendances retrieved successfully",
      data: {
        attendances,
        stats
      }
    });
  } catch (error) {
    console.error("Get all attendances error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get attendances for a specific library with today's stats
export const getLibraryAttendances = async (req, res) => {

  try {
    const library = await Library.findOne({librarian:req.user?._id})
    const  libraryId  = library?._id;
    const { page = 1, limit = 10, startDate, endDate, method } = req.query;

    // Validate library ID
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid library ID",
        error: "INVALID_LIBRARY_ID"
      });
    }

    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    // Build base query
    const baseQuery = { library: libraryId };
    
    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date range",
          error: "INVALID_DATE_RANGE"
        });
      }
      
      baseQuery.checkInTime = { $gte: start, $lte: end };
    }

    // Method filter
    if (method) {
      if (!["QR", "manual"].includes(method)) {
        return res.status(400).json({
          success: false,
          message: "Invalid method. Must be 'QR' or 'manual'",
          error: "INVALID_METHOD"
        });
      }
      baseQuery.method = method;
    }

    // Get date range for booking comparison
    const dateFilter = startDate && endDate 
      ? { bookingDate: { $gte: new Date(startDate), $lte: new Date(endDate) }}
      : {};

    // Today's specific queries
    const todayQuery = { 
      library: libraryId,
      checkInTime: { $gte: todayStart, $lte: todayEnd }
    };

    // Calculate all statistics in parallel
    const [
      attendances,
      totalBookings,
      attendedBookings,
      absentBookings,
      todayStats,
      qrCount,
      manualCount,
      avgDuration,
      dailyAverage,
      uniqueStudents
    ] = await Promise.all([
      // Paginated attendances
      Attendance.paginate(baseQuery, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { checkInTime: -1 },
        populate: [
          { path: "student", select: "name email role", model: "User" },
          { path: "timeSlot", select: "startTime endTime" }
        ]
      }),
      
      // Total bookings in period
      Booking.countDocuments({ 
        library: libraryId,
        status: "confirmed",
        ...dateFilter
      }),
      
      // Attended bookings (have attendance records)
      Booking.countDocuments({
        library: libraryId,
        status: "confirmed",
        _id: { $in: await Attendance.distinct('booking', baseQuery) },
        ...dateFilter
      }),
      
      // Absent bookings (no attendance records)
      Booking.countDocuments({
        library: libraryId,
        status: "confirmed",
        _id: { $nin: await Attendance.distinct('booking', baseQuery) },
        ...dateFilter
      }),
      
      // Today's specific stats
      (async () => {
        const todayAttendances = await Attendance.countDocuments(todayQuery);
        const todayBookings = await Booking.countDocuments({ 
          library: libraryId,
          status: "confirmed",
          bookingDate: { $gte: todayStart, $lte: todayEnd }
        });
        const todayAttended = await Booking.countDocuments({
          library: libraryId,
          status: "confirmed",
          bookingDate: { $gte: todayStart, $lte: todayEnd },
          _id: { $in: await Attendance.distinct('booking', todayQuery) }
        });
        
        return {
          date: todayStart.toISOString().split('T')[0],
          total: todayAttendances,
          bookings: todayBookings,
          attended: todayAttended,
          absent: todayBookings - todayAttended,
          attendanceRate: todayBookings > 0 
            ? Math.round((todayAttended / todayBookings) * 100) 
            : 0
        };
      })(),
      
      // Other stats
      Attendance.countDocuments({ ...baseQuery, method: "QR" }),
      Attendance.countDocuments({ ...baseQuery, method: "manual" }),
      calculateAverageDuration(baseQuery),
      calculateDailyAverage(libraryId, startDate, endDate),
      getUniqueStudentsCount(baseQuery)
    ]);

    // Prepare response
    const response = {
      success: true,
      data: {
        attendances: {
          docs: attendances.docs,
          total: attendances.totalDocs,
          pages: attendances.totalPages,
          page: attendances.page,
          limit: attendances.limit
        },
        stats: {
          totalAttendances: attendances.totalDocs,
          totalBookings,
          attendanceRate: totalBookings > 0 
            ? Math.round((attendedBookings / totalBookings) * 100) 
            : 0,
          absenceRate: totalBookings > 0 
            ? Math.round((absentBookings / totalBookings) * 100) 
            : 0,
          attendedBookings,
          absentBookings,
          today: todayStats,  // Today's specific stats
          qrCount,
          manualCount,
          avgDuration,
          dailyAverage,
          uniqueStudents
        },
        filters: {
          libraryId,
          ...(startDate && endDate && { dateRange: { start: startDate, end: endDate }}),
          ...(method && { method })
        }
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Get library attendances error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve library attendances",
      error: "SERVER_ERROR",
      systemError: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Get attendances for a specific student
export const getMyAttendances = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID"
      });
    }

    const query = { student: studentId };
    
    if (startDate && endDate) {
      query.checkInTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { checkInTime: -1 },
      populate: [
        { path: "library", select: "name location" },
        { path: "timeSlot", select: "startTime endTime" }
      ]
    };
    
    const attendances = await Attendance.paginate(query, options);
    
    // Calculate student-specific stats
    const stats = {
      total: attendances.totalDocs,
      librariesVisited: await getUniqueLibrariesCount(query),
      avgDuration: await calculateAverageDuration(query),
      mostFrequentLibrary: await getMostFrequentLibrary(studentId, startDate, endDate),
      weeklyAverage: await calculateWeeklyAverage(studentId, startDate, endDate),
      checkInMethods: await getCheckInMethodsCount(studentId, startDate, endDate)
    };
    
    return res.status(200).json({
      success: true,
      message: "Student attendances retrieved successfully",
      data: {
        attendances,
        stats
      }
    });
  } catch (error) {
    console.error("Get my attendances error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Helper function to calculate average duration
const calculateAverageDuration = async (query) => {
  const result = await Attendance.aggregate([
    {
      $match: {
        ...query,
        checkOutTime: { $exists: true }
      }
    },
    {
      $project: {
        duration: {
          $divide: [
            { $subtract: ["$checkOutTime", "$checkInTime"] },
            60000 // Convert to minutes
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgDuration: { $avg: "$duration" }
      }
    }
  ]);
  
  return result.length > 0 ? Math.round(result[0].avgDuration) : 0;
};

// Helper function to calculate daily average for a library
const calculateDailyAverage = async (libraryId, startDate, endDate) => {
  const matchQuery = { library: libraryId };
  
  if (startDate && endDate) {
    matchQuery.checkInTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await Attendance.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$checkInTime" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgDaily: { $avg: "$count" }
      }
    }
  ]);
  
  return result.length > 0 ? Math.round(result[0].avgDaily) : 0;
};

// Helper function to get unique libraries count
const getUniqueLibrariesCount = async (query) => {
  const result = await Attendance.aggregate([
    {
      $match: query
    },
    {
      $group: {
        _id: "$library"
      }
    },
    {
      $count: "uniqueLibraries"
    }
  ]);
  
  return result.length > 0 ? result[0].uniqueLibraries : 0;
};

// Helper function to get unique students count
const getUniqueStudentsCount = async (query) => {
  const result = await Attendance.aggregate([
    {
      $match: query
    },
    {
      $group: {
        _id: "$student"
      }
    },
    {
      $count: "uniqueStudents"
    }
  ]);
  
  return result.length > 0 ? result[0].uniqueStudents : 0;
};

// Helper function to get most frequent library for a student
const getMostFrequentLibrary = async (studentId, startDate, endDate) => {
  const matchQuery = { student: studentId };
  
  if (startDate && endDate) {
    matchQuery.checkInTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await Attendance.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: "$library",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 1
    },
    {
      $lookup: {
        from: "libraries",
        localField: "_id",
        foreignField: "_id",
        as: "library"
      }
    },
    {
      $unwind: "$library"
    },
    {
      $project: {
        library: "$library.name",
        count: 1
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : null;
};

// Helper function to calculate weekly average for a student
const calculateWeeklyAverage = async (studentId, startDate, endDate) => {
  const matchQuery = { student: studentId };
  
  if (startDate && endDate) {
    matchQuery.checkInTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await Attendance.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: {
          $week: "$checkInTime"
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgWeekly: { $avg: "$count" }
      }
    }
  ]);
  
  return result.length > 0 ? Math.round(result[0].avgWeekly) : 0;
};

// Helper function to get check-in methods count for a student
const getCheckInMethodsCount = async (studentId, startDate, endDate) => {
  const matchQuery = { student: studentId };
  
  if (startDate && endDate) {
    matchQuery.checkInTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await Attendance.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: "$method",
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        method: "$_id",
        count: 1,
        _id: 0
      }
    }
  ]);
  
  return result;
};