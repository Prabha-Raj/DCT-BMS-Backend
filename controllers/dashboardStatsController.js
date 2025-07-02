import mongoose from "mongoose";
import User from "../model/User.js";
import Library from "../model/LibraryModel.js";
import Booking from "../model/Booking.js";
import Attendance from "../model/Attendance.js";
import Inquiry from "../model/InquiryModel.js";
import Transaction from "../model/Transaction.js";

// Admin Dashboard Stats
export const adminStats = async (req, res) => {
  try {
    // Get counts for all entities
    const [
      totalUsers,
      totalStudents,
      totalLibrarians,
      totalAdmins,
      totalLibraries,
      totalBookings,
      totalTransactions,
      totalInquiries,
      recentBookings,
      recentInquiries,
      revenueStats,
      attendanceStats
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "librarian" }),
      User.countDocuments({ role: "admin" }),
      Library.countDocuments(),
      Booking.countDocuments(),
      Transaction.countDocuments(),
      Inquiry.countDocuments(),
      Booking.find().sort({ createdAt: -1 }).limit(5).populate('user').populate('library'),
      Inquiry.find().sort({ createdAt: -1 }).limit(5),
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            monthlyRevenue: {
              $sum: {
                $cond: [
                  { $gte: ["$createdAt", new Date(new Date().setDate(1))] },
                  "$amount",
                  0
                ]
              }
            }
          }
        }
      ]),
      Attendance.aggregate([
        {
          $group: {
            _id: null,
            totalAttendances: { $sum: 1 },
            avgDuration: { $avg: "$durationMinutes" }
          }
        }
      ])
    ]);

    // Format the revenue stats
    const revenue = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      monthlyRevenue: 0
    };

    // Format attendance stats
    const attendance = attendanceStats.length > 0 ? attendanceStats[0] : {
      totalAttendances: 0,
      avgDuration: 0
    };

    // Calculate booking stats
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform booking stats to object
    const bookingStatus = bookingStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Calculate library stats
    const libraryStats = await Library.aggregate([
      {
        $group: {
          _id: "$isPopular",
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform library stats
    const popularLibraries = libraryStats.find(stat => stat._id === true)?.count || 0;
    const regularLibraries = libraryStats.find(stat => stat._id === false)?.count || 0;

    // Calculate user growth
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 6 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        counts: {
          users: totalUsers,
          students: totalStudents,
          librarians: totalLibrarians,
          admins: totalAdmins,
          libraries: totalLibraries,
          bookings: totalBookings,
          transactions: totalTransactions,
          inquiries: totalInquiries
        },
        revenue,
        attendance,
        bookingStatus,
        libraries: {
          popular: popularLibraries,
          regular: regularLibraries
        },
        recentBookings,
        recentInquiries,
        userGrowth
      }
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard statistics"
    });
  }
};

// Librarian Dashboard Stats
export const librarianStats = async (req, res) => {
  try {
    const librarianId = req.user._id;

    // Get the library managed by this librarian
    const library = await Library.findOne({ librarian: librarianId });
    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Library not found for this librarian"
      });
    }

    const libraryId = library._id;

    // Get all stats for this library
    const [
      totalBookings,
      totalAttendances,
      recentBookings,
      recentAttendances,
      bookingStats,
      revenueStats,
      attendanceStats,
      seatStats
    ] = await Promise.all([
      Booking.countDocuments({ library: libraryId }),
      Attendance.countDocuments({ library: libraryId }),
      Booking.find({ library: libraryId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user')
        .populate('seat'),
      Attendance.find({ library: libraryId })
        .sort({ checkInTime: -1 })
        .limit(5)
        .populate({
          path: 'student',
          model: 'User' // Changed from 'Student' to 'User'
        })
        .populate('timeSlot'),
      Booking.aggregate([
        {
          $match: { library: new mongoose.Types.ObjectId(libraryId) }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            library: new mongoose.Types.ObjectId(libraryId),
            status: "completed",
            type: { $in: ["debit", "credit"] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            monthlyRevenue: {
              $sum: {
                $cond: [
                  { $gte: ["$createdAt", new Date(new Date().setDate(1))] },
                  "$amount",
                  0
                ]
              }
            }
          }
        }
      ]),
      Attendance.aggregate([
        {
          $match: { library: new mongoose.Types.ObjectId(libraryId) }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgDuration: { $avg: "$durationMinutes" },
            qrCount: {
              $sum: {
                $cond: [{ $eq: ["$method", "QR"] }, 1, 0]
              }
            },
            manualCount: {
              $sum: {
                $cond: [{ $eq: ["$method", "manual"] }, 1, 0]
              }
            }
          }
        }
      ]),
      Booking.aggregate([
        {
          $match: {
            library: new mongoose.Types.ObjectId(libraryId),
            status: "confirmed",
            bookingDate: { $gte: new Date() }
          }
        },
        {
          $group: {
            _id: "$seat",
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: "seats",
            localField: "_id",
            foreignField: "_id",
            as: "seat"
          }
        },
        { $unwind: "$seat" },
        { $sort: { "seat.seatNumber": 1 } }
      ])
    ]);

    // Format booking stats
    const formattedBookingStats = bookingStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Format revenue stats
    const revenue = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      monthlyRevenue: 0
    };

    // Format attendance stats
    const attendance = attendanceStats.length > 0 ? attendanceStats[0] : {
      total: 0,
      avgDuration: 0,
      qrCount: 0,
      manualCount: 0
    };

    // Calculate today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayStats = await Promise.all([
      Booking.countDocuments({
        library: libraryId,
        bookingDate: {
          $gte: todayStart,
          $lte: todayEnd
        }
      }),
      Attendance.countDocuments({
        library: libraryId,
        checkInTime: {
          $gte: todayStart,
          $lte: todayEnd
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        library: {
          name: library.libraryName,
          description: library.description,
          logo: library.logo
        },
        counts: {
          bookings: totalBookings,
          attendances: totalAttendances,
          todayBookings: todayStats[0],
          todayAttendances: todayStats[1]
        },
        bookingStatus: formattedBookingStats,
        revenue,
        attendance,
        seatStats,
        recentBookings,
        recentAttendances
      }
    });
  } catch (error) {
    console.error("Error fetching librarian stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch librarian dashboard statistics"
    });
  }
};

// Student Dashboard Stats
export const studentStats = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all stats for this student
    const [
      totalBookings,
      totalAttendances,
      upcomingBookings,
      recentAttendances,
      bookingStats,
      attendanceStats,
      walletBalance
    ] = await Promise.all([
      Booking.countDocuments({ user: studentId }),
      Attendance.countDocuments({ student: studentId }),
      Booking.find({
        user: studentId,
        bookingDate: { $gte: new Date() },
        status: "confirmed"
      })
        .sort({ bookingDate: 1 })
        .limit(5)
        .populate('library')
        .populate('seat')
        .populate('timeSlot'),
      Attendance.find({ student: studentId })
        .sort({ checkInTime: -1 })
        .limit(5)
        .populate('library')
        .populate('timeSlot'),
      Booking.aggregate([
        {
          $match: { user: mongoose.Types.ObjectId(studentId) }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]),
      Attendance.aggregate([
        {
          $match: { student: mongoose.Types.ObjectId(studentId) }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgDuration: { $avg: "$durationMinutes" },
            librariesVisited: { $addToSet: "$library" }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: { user: mongoose.Types.ObjectId(studentId) }
        },
        {
          $group: {
            _id: null,
            balance: {
              $sum: {
                $cond: [
                  { $eq: ["$type", "credit"] },
                  "$amount",
                  { $multiply: ["$amount", -1] }
                ]
              }
            }
          }
        }
      ])
    ]);

    // Format booking stats
    const formattedBookingStats = bookingStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Format attendance stats
    const attendance = attendanceStats.length > 0 ? attendanceStats[0] : {
      total: 0,
      avgDuration: 0,
      librariesVisited: []
    };

    // Format wallet balance
    const balance = walletBalance.length > 0 ? walletBalance[0].balance : 0;

    // Calculate today's attendance
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAttendance = await Attendance.findOne({
      student: studentId,
      checkInTime: {
        $gte: todayStart,
        $lte: todayEnd
      },
      checkOutTime: null
    }).populate('library');

    res.status(200).json({
      success: true,
      data: {
        counts: {
          bookings: totalBookings,
          attendances: totalAttendances,
          librariesVisited: attendance.librariesVisited.length
        },
        bookingStatus: formattedBookingStats,
        attendance: {
          total: attendance.total,
          avgDuration: attendance.avgDuration || 0
        },
        walletBalance: balance,
        upcomingBookings,
        recentAttendances,
        currentAttendance: todayAttendance
      }
    });
  } catch (error) {
    console.error("Error fetching student stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student dashboard statistics"
    });
  }
};