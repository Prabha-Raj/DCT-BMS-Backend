import mongoose from "mongoose";
import User from "../model/User.js";
import Library from "../model/LibraryModel.js";
import Booking from "../model/Booking.js";
import Attendance from "../model/Attendance.js";
import Inquiry from "../model/InquiryModel.js";
import Transaction from "../model/Transaction.js";

// Admin Dashboard Stats
// export const adminStats = async (req, res) => {
//   try {
//     // Get counts for all entities
//     const [
//       totalUsers,
//       totalStudents,
//       totalLibrarians,
//       totalAdmins,
//       totalLibraries,
//       totalBookings,
//       totalTransactions,
//       totalInquiries,
//       recentBookings,
//       recentInquiries,
//       revenueStats,
//       attendanceStats
//     ] = await Promise.all([
//       User.countDocuments(),
//       User.countDocuments({ role: "student" }),
//       User.countDocuments({ role: "librarian" }),
//       User.countDocuments({ role: "admin" }),
//       Library.countDocuments(),
//       Booking.countDocuments(),
//       Transaction.countDocuments(),
//       Inquiry.countDocuments(),
//       Booking.find().sort({ createdAt: -1 }).limit(5).populate('user').populate('library'),
//       Inquiry.find().sort({ createdAt: -1 }).limit(5),
//       Transaction.aggregate([
//         {
//           $match: {
//             status: "completed",
//             type: { $in: ["debit", "credit"] }
//           }
//         },
//         {
//           $group: {
//             _id: null,
//             totalRevenue: { $sum: "$amount" },
//             monthlyRevenue: {
//               $sum: {
//                 $cond: [
//                   { $gte: ["$createdAt", new Date(new Date().setDate(1))] },
//                   "$amount",
//                   0
//                 ]
//               }
//             }
//           }
//         }
//       ]),
//       Attendance.aggregate([
//         {
//           $group: {
//             _id: null,
//             totalAttendances: { $sum: 1 },
//             avgDuration: { $avg: "$durationMinutes" }
//           }
//         }
//       ])
//     ]);

//     // Format the revenue stats
//     const revenue = revenueStats.length > 0 ? revenueStats[0] : {
//       totalRevenue: 0,
//       monthlyRevenue: 0
//     };

//     // Format attendance stats
//     const attendance = attendanceStats.length > 0 ? attendanceStats[0] : {
//       totalAttendances: 0,
//       avgDuration: 0
//     };

//     // Calculate booking stats
//     const bookingStats = await Booking.aggregate([
//       {
//         $group: {
//           _id: "$status",
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Transform booking stats to object
//     const bookingStatus = bookingStats.reduce((acc, curr) => {
//       acc[curr._id] = curr.count;
//       return acc;
//     }, {});

//     // Calculate library stats
//     const libraryStats = await Library.aggregate([
//       {
//         $group: {
//           _id: "$isPopular",
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Transform library stats
//     const popularLibraries = libraryStats.find(stat => stat._id === true)?.count || 0;
//     const regularLibraries = libraryStats.find(stat => stat._id === false)?.count || 0;

//     // Calculate user growth
//     const userGrowth = await User.aggregate([
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m", date: "$createdAt" }
//           },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } },
//       { $limit: 6 }
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         counts: {
//           users: totalUsers,
//           students: totalStudents,
//           librarians: totalLibrarians,
//           admins: totalAdmins,
//           libraries: totalLibraries,
//           bookings: totalBookings,
//           transactions: totalTransactions,
//           inquiries: totalInquiries
//         },
//         revenue,
//         attendance,
//         bookingStatus,
//         libraries: {
//           popular: popularLibraries,
//           regular: regularLibraries
//         },
//         recentBookings,
//         recentInquiries,
//         userGrowth
//       }
//     });
//   } catch (error) {
//     console.error("Error fetching admin stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch admin dashboard statistics"
//     });
//   }
// };


export const adminStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get all stats in parallel
    const [
      // Original stats
      counts,
      attendanceStats,
      bookingStatus,
      libraryStats,
      recentBookings,
      recentInquiries,
      userGrowth,
      
      // New revenue stats
      totalRevenue,
      todayRevenue,
      yesterdayRevenue,
      thisWeekRevenue,
      thisMonthRevenue,
      thisYearRevenue,
      dailyRevenueTrend,
      monthlyRevenueTrend,
      yearlyRevenueTrend
    ] = await Promise.all([
      // Original counts
      Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "student" }),
        User.countDocuments({ role: "librarian" }),
        User.countDocuments({ role: "admin" }),
        Library.countDocuments(),
        Booking.countDocuments(),
        Transaction.countDocuments(),
        Inquiry.countDocuments()
      ]),
      
      // Attendance
      Attendance.aggregate([
        {
          $group: {
            _id: null,
            totalAttendances: { $sum: 1 },
            avgDuration: { $avg: "$durationMinutes" }
          }
        }
      ]),
      
      // Booking status
      Booking.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Library stats
      Library.aggregate([
        {
          $group: {
            _id: "$isPopular",
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Recent bookings
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user')
        .populate('library'),
      
      // Recent inquiries
      Inquiry.find().sort({ createdAt: -1 }).limit(5),
      
      // User growth (original)
      User.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // New revenue stats
      // Total Revenue
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
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // Today's Revenue
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: startOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // Yesterday's Revenue
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: startOfYesterday, $lt: startOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // This Week's Revenue
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: startOfWeek }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // This Month's Revenue
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // This Year's Revenue
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: startOfYear }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // Daily Revenue Trend (Last 7 days)
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            total: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Monthly Revenue Trend (Last 6 months)
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] },
            createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" }
            },
            total: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Yearly Revenue Trend
      Transaction.aggregate([
        {
          $match: {
            status: "completed",
            type: { $in: ["debit", "credit"] }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y", date: "$createdAt" }
            },
            total: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Format the original counts
    const formattedCounts = {
      users: counts[0],
      students: counts[1],
      librarians: counts[2],
      admins: counts[3],
      libraries: counts[4],
      bookings: counts[5],
      transactions: counts[6],
      inquiries: counts[7]
    };

    // Format booking status
    const formattedBookingStatus = bookingStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Format library stats
    const popularLibraries = libraryStats.find(stat => stat._id === true)?.count || 0;
    const regularLibraries = libraryStats.find(stat => stat._id === false)?.count || 0;

    // Format revenue data
    const revenue = {
      total: totalRevenue[0]?.total || 0,
      today: todayRevenue[0]?.total || 0,
      yesterday: yesterdayRevenue[0]?.total || 0,
      thisWeek: thisWeekRevenue[0]?.total || 0,
      thisMonth: thisMonthRevenue[0]?.total || 0,
      thisYear: thisYearRevenue[0]?.total || 0,
      trends: {
        daily: dailyRevenueTrend,
        monthly: monthlyRevenueTrend,
        yearly: yearlyRevenueTrend
      }
    };

    // Final response combining all data
    res.status(200).json({
      success: true,
      data: {
        counts: formattedCounts,
        revenue,
        attendance: attendanceStats[0] || { totalAttendances: 0, avgDuration: 0 },
        bookingStatus: formattedBookingStatus,
        libraries: {
          popular: popularLibraries,
          regular: regularLibraries
        },
        recentBookings,
        recentInquiries,
        userGrowth,
        // Additional data points from original controller can be added here
      }
    });

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics"
    });
  }
};

// export const adminStats = async (req, res) => {
//   try {
//     const now = new Date();
//     const startOfToday = new Date(now.setHours(0, 0, 0, 0));
//     const startOfYesterday = new Date(startOfToday);
//     startOfYesterday.setDate(startOfYesterday.getDate() - 1);
//     const startOfWeek = new Date(startOfToday);
//     startOfWeek.setDate(startOfWeek.getDate() - 7);
//     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//     const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//     const startOfYear = new Date(now.getFullYear(), 0, 1);

//     // 1. Basic Counts and Recent Items
//     const [
//       totalUsers,
//       totalStudents,
//       totalLibrarians,
//       totalAdmins,
//       totalLibraries,
//       totalBookings,
//       totalTransactions,
//       totalInquiries,
//       recentBookings,
//       recentInquiries
//     ] = await Promise.all([
//       User.countDocuments(),
//       User.countDocuments({ role: "student" }),
//       User.countDocuments({ role: "librarian" }),
//       User.countDocuments({ role: "admin" }),
//       Library.countDocuments(),
//       Booking.countDocuments(),
//       Transaction.countDocuments(),
//       Inquiry.countDocuments(),
//       Booking.find().sort({ createdAt: -1 }).limit(5).populate('user').populate('library'),
//       Inquiry.find().sort({ createdAt: -1 }).limit(5)
//     ]);

//     // 2. Revenue Summary
//     const revenueAggregation = await Transaction.aggregate([
//       {
//         $match: {
//           status: "completed",
//           type: { $in: ["debit", "credit"] }
//         }
//       },
//       {
//         $facet: {
//           total: [{ $group: { _id: null, total: { $sum: "$amount" } } }],
//           today: [
//             { $match: { createdAt: { $gte: startOfToday } } },
//             { $group: { _id: null, total: { $sum: "$amount" } } }
//           ],
//           yesterday: [
//             {
//               $match: {
//                 createdAt: { $gte: startOfYesterday, $lt: startOfToday }
//               }
//             },
//             { $group: { _id: null, total: { $sum: "$amount" } } }
//           ],
//           lastWeek: [
//             { $match: { createdAt: { $gte: startOfWeek } } },
//             { $group: { _id: null, total: { $sum: "$amount" } } }
//           ],
//           lastMonth: [
//             { $match: { createdAt: { $gte: startOfMonth } } },
//             { $group: { _id: null, total: { $sum: "$amount" } } }
//           ],
//           lastYear: [
//             { $match: { createdAt: { $gte: startOfYear } } },
//             { $group: { _id: null, total: { $sum: "$amount" } } }
//           ],
//           daily: [
//             {
//               $group: {
//                 _id: {
//                   $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
//                 },
//                 total: { $sum: "$amount" }
//               }
//             },
//             { $sort: { _id: 1 } }
//           ],
//           monthly: [
//             {
//               $group: {
//                 _id: {
//                   $dateToString: { format: "%Y-%m", date: "$createdAt" }
//                 },
//                 total: { $sum: "$amount" }
//               }
//             },
//             { $sort: { _id: 1 } }
//           ],
//           yearly: [
//             {
//               $group: {
//                 _id: {
//                   $dateToString: { format: "%Y", date: "$createdAt" }
//                 },
//                 total: { $sum: "$amount" }
//               }
//             },
//             { $sort: { _id: 1 } }
//           ]
//         }
//       }
//     ]);

//     const revenue = {
//       totalRevenue: revenueAggregation[0].total[0]?.total || 0,
//       todayRevenue: revenueAggregation[0].today[0]?.total || 0,
//       yesterdayRevenue: revenueAggregation[0].yesterday[0]?.total || 0,
//       lastWeekRevenue: revenueAggregation[0].lastWeek[0]?.total || 0,
//       lastMonthRevenue: revenueAggregation[0].lastMonth[0]?.total || 0,
//       lastYearRevenue: revenueAggregation[0].lastYear[0]?.total || 0,
//       daily: revenueAggregation[0].daily,
//       monthly: revenueAggregation[0].monthly,
//       yearly: revenueAggregation[0].yearly
//     };

//     // 3. Attendance Summary
//     const attendanceStats = await Attendance.aggregate([
//       {
//         $group: {
//           _id: null,
//           totalAttendances: { $sum: 1 },
//           avgDuration: { $avg: "$durationMinutes" }
//         }
//       }
//     ]);
//     const attendance = attendanceStats[0] || { totalAttendances: 0, avgDuration: 0 };

//     // 4. Booking Status
//     const bookingStats = await Booking.aggregate([
//       {
//         $group: {
//           _id: "$status",
//           count: { $sum: 1 }
//         }
//       }
//     ]);
//     const bookingStatus = bookingStats.reduce((acc, curr) => {
//       acc[curr._id] = curr.count;
//       return acc;
//     }, {});

//     // 5. Library Popularity
//     const libraryStats = await Library.aggregate([
//       {
//         $group: {
//           _id: "$isPopular",
//           count: { $sum: 1 }
//         }
//       }
//     ]);
//     const popularLibraries = libraryStats.find(stat => stat._id === true)?.count || 0;
//     const regularLibraries = libraryStats.find(stat => stat._id === false)?.count || 0;

//     // 6. User Growth by Month
//     const userGrowth = await User.aggregate([
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m", date: "$createdAt" }
//           },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } },
//       { $limit: 6 }
//     ]);

//     // ✅ Final Response
//     res.status(200).json({
//       success: true,
//       data: {
//         counts: {
//           users: totalUsers,
//           students: totalStudents,
//           librarians: totalLibrarians,
//           admins: totalAdmins,
//           libraries: totalLibraries,
//           bookings: totalBookings,
//           transactions: totalTransactions,
//           inquiries: totalInquiries
//         },
//         revenue,
//         attendance,
//         bookingStatus,
//         libraries: {
//           popular: popularLibraries,
//           regular: regularLibraries
//         },
//         recentBookings,
//         recentInquiries,
//         userGrowth
//       }
//     });
//   } catch (error) {
//     console.error("Error fetching admin stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch admin dashboard statistics"
//     });
//   }
// };

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
          $match: { user: new mongoose.Types.ObjectId(studentId) }
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
          $match: { student: new mongoose.Types.ObjectId(studentId) }
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
          $match: { user: new mongoose.Types.ObjectId(studentId) }
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