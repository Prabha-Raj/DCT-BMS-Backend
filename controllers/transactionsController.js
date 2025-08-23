import Library from "../model/LibraryModel.js";
import Transaction from "../model/Transaction.js";


export const getAllTransactionsAdmin = async (req, res) => {
  try {
    const {
      user,
      library,
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};
    if (user) filter.user = user;
    if (library) filter.library = library;
    if (type) filter.type = type;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (page - 1) * limit;
    
    // Get paginated transactions
    const transactionsQuery = Transaction.find(filter)
      .populate('user', 'name email mobile role')
      .populate('wallet', 'balance')
      .populate('library', 'libraryName email')
      .populate({
        path: 'bookings',
        populate: [
          { path: 'seat', select: 'seatName seatNumber' },
          { path: 'timeSlot', select: 'startTime endTime price' },
          { path: 'library', select: 'libraryName' }
        ]
      })
      .populate({
        path: 'monthlyBooking',
        populate: [
          { path: 'seat', select: 'seatName seatNumber' },
          { path: 'library', select: 'libraryName' }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalQuery = Transaction.countDocuments(filter);

    // Get statistics
    const statsQuery = Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          creditedCount: {
            $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] }
          },
          creditedAmount: {
            $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] }
          },
          debitedCount: {
            $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] }
          },
          debitedAmount: {
            $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] }
          },
          refundedCount: {
            $sum: { $cond: [{ $eq: ["$type", "refund"] }, 1, 0] }
          },
          refundedAmount: {
            $sum: { $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0] }
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          totalAmount: 1,
          creditedCount: 1,
          creditedAmount: 1,
          debitedCount: 1,
          debitedAmount: 1,
          refundedCount: 1,
          refundedAmount: 1,
          completedCount: 1,
          pendingCount: 1,
          failedCount: 1,
          // Calculate revenue/profit (assuming profit is debited amount minus refunded amount)
          revenue: {
            $subtract: [
              { $sum: "$debitedAmount" },
              { $sum: "$refundedAmount" }
            ]
          }
        }
      }
    ]);

    // Execute all queries in parallel
    const [transactions, total, statsResult] = await Promise.all([
      transactionsQuery,
      totalQuery,
      statsQuery
    ]);

    const stats = statsResult[0] || {
      totalTransactions: 0,
      totalAmount: 0,
      creditedCount: 0,
      creditedAmount: 0,
      debitedCount: 0,
      debitedAmount: 0,
      refundedCount: 0,
      refundedAmount: 0,
      completedCount: 0,
      pendingCount: 0,
      failedCount: 0,
      revenue: 0
    };

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: transactions,
      stats: {
        ...stats,
        // Add additional calculated fields if needed
        averageTransactionAmount: total > 0 ? stats.totalAmount / total : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Student: Get own transactions
export const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await Transaction.find({ user: userId })
      .populate('library', 'libraryName')
      .populate({
        path: 'bookings',
        populate: [
          { path: 'seat', select: 'seatName seatNumber' },
          { path: 'timeSlot', select: 'startTime endTime price' }
        ]
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Librarian: Get all transactions related to their library
export const getLibraryTransactions = async (req, res) => {
  try {
    const librarianId = req.user._id;

    const libraries = await Library.find({ librarian: librarianId }).select('_id');
    const libraryIds = libraries.map(lib => lib._id);

    const transactions = await Transaction.find({ library: { $in: libraryIds } })
      .populate('user', 'name email mobile')
      .populate({
        path: 'bookings',
        populate: [
          { path: 'seat', select: 'seatName seatNumber' },
          { path: 'timeSlot', select: 'startTime endTime price' }
        ]
      })
      .populate('library', 'libraryName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};