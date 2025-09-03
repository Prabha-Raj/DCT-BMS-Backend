import Booking from '../model/Booking.js';
import MonthlyBooking from '../model/MonthlyBooking.js';
import WithdrawRequest from '../model/WithdrawRequest.js';

// Get total earnings for a library from completed bookings
export const getEarningsByLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;
    if (!libraryId) {
      return res.status(400).json({ error: 'Library ID is required' });
    }

    // Find bookings for the library excluding 'pending', 'cancelled', 'rejected'
    const earningBookings = await Booking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid'
    }).populate("user", "name email mobile role profileImage");

    // Find monthly bookings for the library where month has started
    const today = new Date();
    const earningMonthlyBookings = await MonthlyBooking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid',
      startDate: { $lte: today }
    }).populate("user", "name email mobile role profileImage");

    // Sum the amounts from eligible bookings
    const totalBookingEarnings = earningBookings.reduce((sum, booking) => {
      return sum + (booking.amount || 0);
    }, 0);
    const totalMonthlyEarnings = earningMonthlyBookings.reduce((sum, booking) => {
      return sum + (booking.amount || 0);
    }, 0);
    const totalEarnings = totalBookingEarnings + totalMonthlyEarnings;

    // Prepare booking history: user, amount, bookingDate
    const bookingHistory = earningBookings.map(booking => ({
      user: booking.user,
      amount: booking.amount,
      bookingDate: booking.bookingDate,
      status: booking.status,
      type: 'single'
    }));
    const monthlyBookingHistory = earningMonthlyBookings.map(booking => ({
      user: booking.user,
      amount: booking.amount,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: booking.status,
      type: 'monthly'
    }));

    return res.json({
      libraryId,
      totalEarnings,
      bookingHistory: [...bookingHistory, ...monthlyBookingHistory]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get my earnings and withdraw history for a library
export const getMyEarningsByLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;
    if (!libraryId) {
      return res.status(400).json({ error: 'Library ID is required' });
    }

    // Bookings
    const earningBookings = await Booking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid'
    }).populate("user", "name email mobile role profileImage");

    // Monthly Bookings
    const today = new Date();
    const earningMonthlyBookings = await MonthlyBooking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid',
      startDate: { $lte: today }
    }).populate("user", "name email mobile role profileImage");

    // Earnings
    const totalBookingEarnings = earningBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const totalMonthlyEarnings = earningMonthlyBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const totalRevenue = totalBookingEarnings + totalMonthlyEarnings;

    // Withdraw requests for this library
    const withdrawRequests = await WithdrawRequest.find({ library: libraryId });

    // Withdrawn amount (resolved only)
    const withdrawnAmount = withdrawRequests
      .filter(req => req.status === 'resolved')
      .reduce((sum, req) => sum + (req.requestedAmount || 0), 0);

    // Pending withdraw amount
    const pendingWithdrawAmount = withdrawRequests
      .filter(req => req.status === 'pending')
      .reduce((sum, req) => sum + (req.requestedAmount || 0), 0);

    // Withdrawable amount
    const withdrawableAmount = totalRevenue - withdrawnAmount;
    console.log(withdrawRequests)
    // Withdraw history
    const withdrawHistory = withdrawRequests.map(req => ({
      _id:req._id,
      amount: req.requestedAmount,
      status: req.status,
      requestedAt: req.requestedAt,
      resolvedAt: req.resolvedAt,
      rejectedAt: req.rejectedAt,
      rejectedReason: req.rejectedReason
    }));

    // Stats response
    return res.json({
      libraryId,
      stats: {
        totalRevenue,
        totalEarningFromOneTimeBooking:totalBookingEarnings,
        totalEarningFromOneTimeMonthlyBooking:totalMonthlyEarnings,
        withdrawnAmount,
        withdrawableAmount,
        pendingWithdrawAmount
      },
      earningHistory: [
        ...earningBookings.map(booking => ({
          user: booking.user,
          amount: booking.amount,
          bookingDate: booking.bookingDate,
          status: booking.status,
          type: 'single'
        })),
        ...earningMonthlyBookings.map(booking => ({
          user: booking.user,
          amount: booking.amount,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
          type: 'monthly'
        }))
      ],
      withdrawHistory
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRevenue = async (libraryId) => {
  try {
    console.log(libraryId)
    if (!libraryId) {
      return 'Library ID is required';
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // One-time Bookings
    const earningBookings = await Booking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid'
    });
    const totalOneTimeBookings = (await Booking.find({library: libraryId})).length;
    const totalMonthlyBookings = (await MonthlyBooking.find({library: libraryId})).length;
    const todaysOneTimeBookings = (await Booking.find({
      library: libraryId,
      paymentStatus: 'paid',
      bookingDate: { $gte: todayStart, $lte: todayEnd }
    })).length;
    const todaysMonthlyBookings = await MonthlyBooking.find({
      library: libraryId,
      paymentStatus: 'paid',
      startDate: { $gte: todayStart, $lte: todayEnd }
    });
   console.log("fghj",totalOneTimeBookings)
    const todayBookingEarnings = await Booking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid',
      bookingDate: { $gte: todayStart, $lte: todayEnd }
    });

    // Monthly Bookings
    const earningMonthlyBookings = await MonthlyBooking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid',
      startDate: { $lte: todayEnd }
    });
    const todayMonthlyBookings = await MonthlyBooking.find({
      library: libraryId,
      status: { $nin: ['pending', 'cancelled', 'rejected'] },
      paymentStatus: 'paid',
      startDate: { $gte: todayStart, $lte: todayEnd }
    });

    // Earnings
    const totalBookingEarnings = earningBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const totalMonthlyEarnings = earningMonthlyBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const totalRevenue = totalBookingEarnings + totalMonthlyEarnings;
    const todaysOneTimeEarning = todayBookingEarnings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const todaysMonthlyEarning = todayMonthlyBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);

    // Withdraw requests for this library
    const withdrawRequests = await WithdrawRequest.find({ library: libraryId });
    const withdrawnAmount = withdrawRequests.filter(req => req.status === 'resolved').reduce((sum, req) => sum + (req.requestedAmount || 0), 0);
    const pendingWithdrawAmount = withdrawRequests.filter(req => req.status === 'pending').reduce((sum, req) => sum + (req.requestedAmount || 0), 0);

    return {
      totalRevenue,
      totalBookingEarnings,
      totalMonthlyEarnings,
      todaysOneTimeEarning,
      todaysMonthlyEarning,
      totalBookings:totalOneTimeBookings+totalMonthlyBookings,
      totalOneTimeBookings,
      totalMonthlyBookings,
      todaysOneTimeBookings,
      todaysMonthlyBookings,
      withdrawnAmount,
      pendingWithdrawAmount,
      withdrawableAmount: totalRevenue - withdrawnAmount
    };
  } catch (error) {
    console.error(error);
    return {};
  }
};
