import mongoose from "mongoose";
import moment from "moment";
import MonthlyBooking from "../model/MonthlyBooking.js";
import MonthlyBookingAttendance from "../model/MonthlyBookingAttendance.js";
import Library from "../model/LibraryModel.js";

// Check-in controller for monthly booking
export const monthlyCheckIn = async (req, res) => {
  try {
    const { libraryId, bookingId } = req.params;
    const method = "QR";
    const studentId = req.user?._id;

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

    const booking = await MonthlyBooking.findOne({
      _id: bookingId,
      user: studentId,
      library: libraryId,
      status: "confirmed",
      paymentStatus: "paid"
    });

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: "No valid monthly booking found with the provided ID"
      });
    }

    const now = new Date();
    if (now < booking.startDate || now > booking.endDate) {
      return res.status(400).json({
        success: false,
        message: "Check-in is only allowed during your booking period",
        bookingPeriod: {
          start: booking.startDate,
          end: booking.endDate
        },
        currentDate: now
      });
    }

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    let attendance = await MonthlyBookingAttendance.findOne({
      booking: bookingId,
      date: today
    });

    if (!attendance) {
      attendance = new MonthlyBookingAttendance({
        student: studentId,
        library: libraryId,
        booking: bookingId,
        date: today,
        method,
        sessions: []
      });
    }

    const activeSession = attendance.sessions.find(session => !session.checkOutTime);
    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: "You have an active session. Please check out first.",
        canCheckOut: true,
        attendanceId: attendance._id,
        sessionId: activeSession._id
      });
    }

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
      message: "Checked in successfully",
      data: populatedAttendance
    });
  } catch (error) {
    console.error("Monthly check-in error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Check-out controller for monthly booking
export const monthlyCheckOut = async (req, res) => {
  try {
    const { libraryId, bookingId } = req.params;
    const studentId = req.user?._id;

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

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const attendance = await MonthlyBookingAttendance.findOne({
      student: studentId,
      library: libraryId,
      booking: bookingId,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "No check-in found for today"
      });
    }

    const activeSessionIndex = attendance.sessions.findIndex(session => !session.checkOutTime);
    if (activeSessionIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "No active session found. Please check in first."
      });
    }

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
      message: "Checked out successfully",
      data: populatedAttendance
    });
  } catch (error) {
    console.error("Monthly check-out error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Check-in controller for monthly booking by librarian
export const monthlyCheckInManualy = async (req, res) => {
  try {
    const { libraryId, bookingId, studentId } = req.body;
    const method = "manual";
 
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

    const booking = await MonthlyBooking.findOne({
      _id: bookingId,
      user: studentId,
      library: libraryId,
      status: "confirmed",
      paymentStatus: "paid"
    });

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: "No valid monthly booking found with the provided ID"
      });
    }

    const now = new Date();
    if (now < booking.startDate || now > booking.endDate) {
      return res.status(400).json({
        success: false,
        message: "Check-in is only allowed during your booking period",
        bookingPeriod: {
          start: booking.startDate,
          end: booking.endDate
        },
        currentDate: now
      });
    }

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    let attendance = await MonthlyBookingAttendance.findOne({
      booking: bookingId,
      date: today
    });

    if (!attendance) {
      attendance = new MonthlyBookingAttendance({
        student: studentId,
        library: libraryId,
        booking: bookingId,
        date: today,
        method,
        sessions: []
      });
    }

    const activeSession = attendance.sessions.find(session => !session.checkOutTime);
    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: "You have an active session. Please check out first.",
        canCheckOut: true,
        attendanceId: attendance._id,
        sessionId: activeSession._id
      });
    }

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
      message: "Checked in successfully",
      data: populatedAttendance
    });
  } catch (error) {
    console.error("Monthly check-in error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Check-out controller for monthly booking by librarian
export const monthlyCheckOutManualy = async (req, res) => {
  try {
    const { libraryId, bookingId, studentId } = req.body;

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

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const attendance = await MonthlyBookingAttendance.findOne({
      student: studentId,
      library: libraryId,
      booking: bookingId,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "No check-in found for today"
      });
    }

    const activeSessionIndex = attendance.sessions.findIndex(session => !session.checkOutTime);
    if (activeSessionIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "No active session found. Please check in first."
      });
    }

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
      message: "Checked out successfully",
      data: populatedAttendance
    });
  } catch (error) {
    console.error("Monthly check-out error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get all monthly booking attendances (for admin)
export const getAllMonthlyAttendances = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, libraryId, method, studentId } = req.query;
    
    const query = {};
    
    if (startDate && endDate) {
      query.date = {
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
      sort: { date: -1 },
      populate: [
        { path: "student", select: "name email" },
        { path: "library", select: "name" },
        { path: "booking", select: "startDate endDate" }
      ]
    };
    
    const attendances = await MonthlyBookingAttendance.paginate(query, options);
    
    const stats = {
      total: attendances.totalDocs,
      qrCount: await MonthlyBookingAttendance.countDocuments({ ...query, method: "QR" }),
      manualCount: await MonthlyBookingAttendance.countDocuments({ ...query, method: "manual" }),
      avgDuration: await calculateMonthlyAvgDuration(query),
      uniqueStudents: await getMonthlyUniqueStudentsCount(query),
      uniqueLibraries: await getMonthlyUniqueLibrariesCount(query),
      totalSessions: await getTotalSessionsCount(query)
    };
    
    return res.status(200).json({
      success: true,
      message: "Monthly booking attendances retrieved successfully",
      data: {
        attendances,
        stats
      }
    });
  } catch (error) {
    console.error("Get all monthly attendances error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


// Get monthly booking attendances for a specific student
// export const getMyMonthlyAttendances = async (req, res) => {
//   try {
//     const studentId = req.user?._id;
//     const { page = 1, limit = 10, startDate, endDate } = req.query;
    
//     if (!mongoose.Types.ObjectId.isValid(studentId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid student ID"
//       });
//     }

//     const query = { student: studentId };
    
//     if (startDate && endDate) {
//       query.date = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       };
//     }
    
//     const options = {
//       page: parseInt(page),
//       limit: parseInt(limit),
//       sort: { date: -1 },
//       populate: [
//         { path: "library", select: "name location" },
//         { path: "booking", select: "startDate endDate" }
//       ]
//     };
    
//     const attendances = await MonthlyBookingAttendance.paginate(query, options);
    
//     const stats = {
//       total: attendances.totalDocs,
//       librariesVisited: await getMonthlyUniqueLibrariesCount(query),
//       avgDuration: await calculateMonthlyAvgDuration(query),
//       mostFrequentLibrary: await getMonthlyMostFrequentLibrary(studentId, startDate, endDate),
//       monthlyAverage: await calculateMonthlyAverage(studentId, startDate, endDate),
//       checkInMethods: await getMonthlyCheckInMethodsCount(studentId, startDate, endDate),
//       totalSessions: await getTotalSessionsCount(query)
//     };
    
//     return res.status(200).json({
//       success: true,
//       message: "Student monthly booking attendances retrieved successfully",
//       data: {
//         attendances,
//         stats
//       }
//     });
//   } catch (error) {
//     console.error("Get my monthly attendances error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// };

// Get monthly booking attendances for a specific student (without query params)
export const getMyMonthlyAttendances = async (req, res) => {
  try {
    const studentId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID"
      });
    }

    // Get current month and year for filtering
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate start and end of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Get attendances for current month only with optimized query
    const attendances = await MonthlyBookingAttendance.find({ 
      student: studentId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    })
    .sort({ date: -1 })
    .populate([
      { 
        path: "library", 
        select: "name location" 
      },
      { 
        path: "booking", 
        select: "startDate endDate status" 
      }
    ])
    .lean(); // Use lean() for better performance

    // Format the response data
    const formattedAttendances = attendances.map(attendance => {
      const sessions = attendance.sessions.map(session => ({
        checkInTime: session.checkInTime,
        checkOutTime: session.checkOutTime,
        durationMinutes: session.durationMinutes
      }));
      
      return {
        _id: attendance._id,
        date: attendance.date,
        library: attendance.library,
        booking: attendance.booking,
        sessions: sessions,
        totalDurationMinutes: attendance.totalDurationMinutes,
        method: attendance.method,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt
      };
    });

    // Calculate all stats in parallel
    const [
      librariesVisited,
      avgDuration,
      mostFrequentLibrary,
      monthlyAverage,
      checkInMethods,
      totalSessions
    ] = await Promise.all([
      // 1. Get unique libraries count
      MonthlyBookingAttendance.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: "$library"
          }
        },
        {
          $count: "count"
        }
      ]).then(result => result[0]?.count || 0),
      
      // 2. Calculate average duration
      MonthlyBookingAttendance.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            date: { $gte: startOfMonth, $lte: endOfMonth },
            totalDurationMinutes: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: "$totalDurationMinutes" }
          }
        }
      ]).then(result => Math.round(result[0]?.avgDuration || 0)),
      
      // 3. Get most frequent library
      MonthlyBookingAttendance.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
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
            as: "libraryInfo"
          }
        },
        {
          $unwind: "$libraryInfo"
        },
        {
          $project: {
            _id: 0,
            library: {
              _id: "$_id",
              name: "$libraryInfo.name",
              location: "$libraryInfo.location"
            },
            visits: "$count"
          }
        }
      ]).then(result => result[0] || null),
      
      // 4. Calculate monthly average (average visits per day)
      MonthlyBookingAttendance.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            uniqueDays: { $addToSet: "$date" }
          }
        },
        {
          $project: {
            _id: 0,
            averageVisitsPerDay: {
              $cond: {
                if: { $gt: [{ $size: "$uniqueDays" }, 0] },
                then: { $divide: ["$totalVisits", { $size: "$uniqueDays" }] },
                else: 0
              }
            }
          }
        }
      ]).then(result => Math.round((result[0]?.averageVisitsPerDay || 0) * 100) / 100),
      
      // 5. Get check-in methods count
      MonthlyBookingAttendance.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: "$method",
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            method: "$_id",
            count: 1
          }
        }
      ]).then(result => result),
      
      // 6. Get total sessions count
      MonthlyBookingAttendance.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $project: {
            sessionCount: { $size: "$sessions" }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: "$sessionCount" }
          }
        }
      ]).then(result => result[0]?.totalSessions || 0)
    ]);

    const stats = {
      total: attendances.length,
      librariesVisited,
      avgDuration,
      mostFrequentLibrary,
      monthlyAverage,
      checkInMethods,
      totalSessions,
      month: now.toLocaleString('default', { month: 'long' }),
      year: currentYear
    };

    return res.status(200).json({
      success: true,
      message: "Student monthly booking attendances retrieved successfully.",
      data: {
        attendances: formattedAttendances,
        stats
      }
    });
  } catch (error) {
    console.error("Get my monthly attendances error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get detailed attendance for a specific date
export const getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.params;
    const studentId = req.user?._id;
    
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    
    const attendance = await MonthlyBookingAttendance.findOne({
      student: studentId,
      date: queryDate
    })
    .populate("library", "name location")
    .populate("booking", "startDate endDate");
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found for this date"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Daily attendance retrieved successfully",
      data: attendance
    });
  } catch (error) {
    console.error("Get daily attendance error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Helper function to calculate average duration for monthly bookings
const calculateMonthlyAvgDuration = async (query) => {
  const result = await MonthlyBookingAttendance.aggregate([
    {
      $match: query
    },
    {
      $project: {
        totalDuration: "$totalDurationMinutes"
      }
    },
    {
      $group: {
        _id: null,
        avgDuration: { $avg: "$totalDuration" }
      }
    }
  ]);
  
  return result.length > 0 ? Math.round(result[0].avgDuration) : 0;
};

// Helper function to get unique libraries count for monthly bookings
const getMonthlyUniqueLibrariesCount = async (query) => {
  const result = await MonthlyBookingAttendance.aggregate([
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

// Helper function to get unique students count for monthly bookings
const getMonthlyUniqueStudentsCount = async (query) => {
  const result = await MonthlyBookingAttendance.aggregate([
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

// Helper function to get most frequent library for a student (monthly bookings)
const getMonthlyMostFrequentLibrary = async (studentId, startDate, endDate) => {
  const matchQuery = { student: studentId };
  
  if (startDate && endDate) {
    matchQuery.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await MonthlyBookingAttendance.aggregate([
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

// Helper function to calculate monthly average for a student
const calculateMonthlyAverage = async (studentId, startDate, endDate) => {
  const matchQuery = { student: studentId };
  
  if (startDate && endDate) {
    matchQuery.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await MonthlyBookingAttendance.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$date" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgMonthly: { $avg: "$count" }
      }
    }
  ]);
  
  return result.length > 0 ? Math.round(result[0].avgMonthly) : 0;
};

// Helper function to get check-in methods count for a student (monthly bookings)
const getMonthlyCheckInMethodsCount = async (studentId, startDate, endDate) => {
  const matchQuery = { student: studentId };
  
  if (startDate && endDate) {
    matchQuery.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await MonthlyBookingAttendance.aggregate([
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

// Helper function to get total sessions count
const getTotalSessionsCount = async (query) => {
  const result = await MonthlyBookingAttendance.aggregate([
    {
      $match: query
    },
    {
      $project: {
        sessionCount: { $size: "$sessions" }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: "$sessionCount" }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].totalSessions : 0;
};


// Get all monthly booking attendances for librarian's library only
export const getAllMonthlyBookingAttendancesForLibrary = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const librarianId = req.user._id;
    
    // Find the librarian's library
    const librarianLibrary = await Library.findOne({ 
      librarian: librarianId 
    }).select('_id libraryName');
    
    if (!librarianLibrary) {
      return res.status(404).json({
        success: false,
        message: "No library found for this librarian"
      });
    }
    
    const libraryId = librarianLibrary._id;
    
    // Set query to only include the librarian's library
    const query = { library: libraryId };
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { date: -1 },
      populate: [
        { path: "student", select: "name email studentId" },
        { path: "library", select: "name location" },
        { path: "booking", select: "startDate endDate status" }
      ]
    };
    
    const attendances = await MonthlyBookingAttendance.paginate(query, options);
    
    // Calculate comprehensive statistics for this specific library
    const stats = await calculateLibraryStats(query, libraryId);
    
    return res.status(200).json({
      success: true,
      message: `Monthly booking attendances for ${librarianLibrary.libraryName} retrieved successfully`,
      data: {
        attendances,
        stats,
        libraryInfo: {
          _id: librarianLibrary._id,
          name: librarianLibrary.libraryName
        }
      }
    });
  } catch (error) {
    console.error("Get all monthly attendances error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Helper function to calculate comprehensive library statistics
const calculateLibraryStats = async (query, libraryId) => {
  const matchStage = { ...query };
  
  // Get basic counts
  const [
    totalAttendances,
    qrCount,
    manualCount,
    totalSessions,
    uniqueStudents,
    avgDuration,
    todayAttendance,
    currentMonthStats,
    totalRegisteredStudents
  ] = await Promise.all([
    MonthlyBookingAttendance.countDocuments(matchStage),
    MonthlyBookingAttendance.countDocuments({ ...matchStage, method: "QR" }),
    MonthlyBookingAttendance.countDocuments({ ...matchStage, method: "manual" }),
    // Total sessions count
    MonthlyBookingAttendance.aggregate([
      { $match: matchStage },
      { $project: { sessionCount: { $size: "$sessions" } } },
      { $group: { _id: null, total: { $sum: "$sessionCount" } } }
    ]).then(result => result[0]?.total || 0),
    // Unique students count
    MonthlyBookingAttendance.aggregate([
      { $match: matchStage },
      { $group: { _id: "$student" } },
      { $count: "count" }
    ]).then(result => result[0]?.count || 0),
    // Average duration
    MonthlyBookingAttendance.aggregate([
      { 
        $match: { 
          ...matchStage, 
          totalDurationMinutes: { $gt: 0 } 
        } 
      },
      { $group: { _id: null, avgDuration: { $avg: "$totalDurationMinutes" } } }
    ]).then(result => Math.round(result[0]?.avgDuration || 0)),
    // Today's attendance
    MonthlyBookingAttendance.countDocuments({
      ...matchStage,
      date: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }),
    // Current month statistics
    MonthlyBookingAttendance.aggregate([
      {
        $match: {
          ...matchStage,
          date: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            $lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          uniqueStudents: { $addToSet: "$student" },
          totalDuration: { $sum: "$totalDurationMinutes" }
        }
      },
      {
        $project: {
          _id: 0,
          totalVisits: 1,
          uniqueStudentCount: { $size: "$uniqueStudents" },
          averageDuration: { $round: [{ $divide: ["$totalDuration", "$totalVisits"] }, 2] }
        }
      }
    ]).then(result => result[0] || {
      totalVisits: 0,
      uniqueStudentCount: 0,
      averageDuration: 0
    }),
    // Total registered students in this library
    MonthlyBooking.countDocuments({ 
      library: libraryId,
      status: "confirmed",
      endDate: { $gte: new Date() }
    })
  ]);

  // Get daily attendance trends for graphs (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const dailyTrends = await MonthlyBookingAttendance.aggregate([
    { 
      $match: { 
        ...matchStage,
        date: { $gte: thirtyDaysAgo }
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        attendanceCount: { $sum: 1 },
        studentCount: { $addToSet: "$student" },
        totalDuration: { $sum: "$totalDurationMinutes" }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: "$_id",
        attendanceCount: 1,
        studentCount: { $size: "$studentCount" },
        averageDuration: { 
          $cond: {
            if: { $gt: ["$attendanceCount", 0] },
            then: { $round: [{ $divide: ["$totalDuration", "$attendanceCount"] }, 2] },
            else: 0
          }
        },
        _id: 0
      }
    }
  ]);

  // Get top students by attendance
  const topStudents = await MonthlyBookingAttendance.aggregate([
    {
      $match: matchStage
    },
    {
      $group: {
        _id: "$student",
        visitCount: { $sum: 1 },
        totalDuration: { $sum: "$totalDurationMinutes" }
      }
    },
    { $sort: { visitCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "studentInfo"
      }
    },
    { $unwind: "$studentInfo" },
    {
      $project: {
        _id: 0,
        student: {
          _id: "$_id",
          name: "$studentInfo.name",
          email: "$studentInfo.email"
        },
        visitCount: 1,
        averageDuration: { 
          $cond: {
            if: { $gt: ["$visitCount", 0] },
            then: { $round: [{ $divide: ["$totalDuration", "$visitCount"] }, 2] },
            else: 0
          }
        }
      }
    }
  ]);

  // Get attendance by day of week
  const attendanceByDay = await MonthlyBookingAttendance.aggregate([
    {
      $match: matchStage
    },
    {
      $group: {
        _id: { $dayOfWeek: "$date" },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        dayOfWeek: "$_id",
        count: 1
      }
    }
  ]);

  return {
    summary: {
      totalAttendances,
      qrCount,
      manualCount,
      totalSessions,
      uniqueStudents,
      avgDuration,
      totalRegisteredStudents,
      todayAttendance,
      currentMonth: currentMonthStats
    },
    trends: {
      daily: dailyTrends
    },
    analytics: {
      topStudents,
      attendanceByDay
    }
  };
};

// Export all functions as named exports
export default {
  monthlyCheckIn,
  monthlyCheckOut,
  getAllMonthlyAttendances,
  getMyMonthlyAttendances,
  getDailyAttendance
};