import mongoose from "mongoose";
import MonthlyBooking from "../model/MonthlyBooking.js";
import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";
import Library from "../model/LibraryModel.js";
import Seat from "../model/Seat.js";
import User from "../model/User.js";

// Helper function to check for existing monthly bookings on the same seat
const checkMonthlyBookingConflicts = async (seatId, startDate, endDate, session) => {
    const existingBookings = await MonthlyBooking.find({
        seat: seatId,
        $or: [
            {
                startDate: { $lte: endDate },
                endDate: { $gte: startDate }
            }
        ],
        status: { $in: ["confirmed", "pending"] }
    }).session(session);

    return existingBookings.length > 0;
};

export const createMonthlyBooking = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const { seat: seatId, library: libraryId } = req.body;
            const userId = req.user._id;

            // Input validation
            if (!seatId || !libraryId) {
                throw { statusCode: 400, message: "Seat and library are required" };
            }

            // Fetch required documents
            const [seat, library, user] = await Promise.all([
                Seat.findById(seatId).session(session),
                Library.findById(libraryId).session(session),
                User.findById(userId).session(session)
            ]);

            // Validate documents
            if (!seat) throw { statusCode: 404, message: "Seat not found" };
            if (!library) throw { statusCode: 404, message: "Library not found" };
            if (!user) throw { statusCode: 404, message: "User not found" };

            if (seat.library.toString() !== libraryId) {
                throw { statusCode: 400, message: "Seat does not belong to the specified library" };
            }

            // Calculate booking dates (30 days from now)
            const startDate = new Date();
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 30);
            endDate.setHours(23, 59, 59, 999);

            // Check for conflicts
            const hasConflict = await checkMonthlyBookingConflicts(
                seatId,
                startDate,
                endDate,
                session
            );

            if (hasConflict) {
                throw {
                    statusCode: 400,
                    message: "This seat is already booked for the monthly period"
                };
            }

            // Get monthly fee from library
            const amount = library.monthlyFee;
            if (amount <= 0) {
                throw {
                    statusCode: 400,
                    message: "Monthly booking is not available for this library"
                };
            }

            // Process payment
            const wallet = await Wallet.findOne({ user: userId }).session(session);
            if (!wallet || wallet.balance < amount) {
                throw { statusCode: 400, message: "Insufficient balance" };
            }

            // Deduct from wallet
            wallet.balance -= amount;
            await wallet.save({ session });

            // Create transaction
            const transaction = new Transaction({
                wallet: wallet._id,
                user: userId,
                type: 'debit',
                amount,
                description: `Monthly booking at ${library.libraryName}`,
                library: libraryId,
                status: 'completed'
            });
            await transaction.save({ session });

            // Create monthly booking
            const monthlyBooking = new MonthlyBooking({
                user: userId,
                seat: seatId,
                library: libraryId,
                startDate,
                endDate,
                amount,
                status: "confirmed",
                paymentStatus: "paid",
                paymentId: transaction._id,
                bookedAt: new Date()
            });

            await monthlyBooking.save({ session });

            transaction.monthlyBooking = monthlyBooking._id
            await transaction.save()

            // Populate the response
            const populatedBooking = await MonthlyBooking.findById(monthlyBooking._id)
                .populate("user", "-password")
                .populate("seat")
                .populate("library")
                .populate("paymentId")
                .session(session);

            res.status(201).json({
                success: true,
                message: "Monthly booking created successfully",
                booking: populatedBooking,
                transaction
            });
        });
    } catch (error) {
        console.error("Monthly booking error:", error);

        const statusCode = error.statusCode || 500;
        const response = {
            success: false,
            message: error.message || "Monthly booking failed"
        };

        if (process.env.NODE_ENV === "development") {
            response.error = error.stack;
        }

        res.status(statusCode).json(response);
    } finally {
        await session.endSession();
    }
};

// Get user's monthly bookings
export const getMyMonthlyBookings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, } = req.query;

        const filter = { user: userId };
        if (status) filter.status = status;

        const bookings = await MonthlyBooking.find(filter)
            .populate('seat')
            .populate('library')
            .populate('paymentId')
            .sort({ bookingDate: -1 })

        res.status(200).json({
            success: true,
            message:"These are your monthly bookings",
            bookings
        });

    } catch (error) {
        console.error("Error fetching monthly bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch monthly bookings"
        });
    }
};

// Cancel a monthly booking
export const cancelMonthlyBooking = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const { bookingId } = req.params;
            const userId = req.user._id;

            const booking = await MonthlyBooking.findOne({
                _id: bookingId,
                user: userId
            }).session(session);

            if (!booking) {
                throw { statusCode: 404, message: "Booking not found" };
            }

            // Check if booking can be cancelled
            if (booking.status === "cancelled") {
                throw { statusCode: 400, message: "Booking is already cancelled" };
            }

            if (booking.status === "completed") {
                throw { statusCode: 400, message: "Completed bookings cannot be cancelled" };
            }

            // Check if booking has already started
            const now = new Date();

            // Add 1 day grace period
            const cancelLimit = new Date(booking.startDate);
            cancelLimit.setDate(cancelLimit.getDate() + 1);

            if (now >= cancelLimit) {
                throw {
                    statusCode: 400,
                    message: "Cannot cancel booking after one day of Booking date"
                };
            }

            // Update booking status
            booking.status = "cancelled";
            await booking.save({ session });

            // Refund payment if applicable
            if (booking.paymentStatus === "paid") {
                const wallet = await Wallet.findOne({ user: userId }).session(session);
                if (wallet) {
                    wallet.balance += booking.amount;
                    await wallet.save({ session });

                    // Create refund transaction
                    const refundTransaction = new Transaction({
                        wallet: wallet._id,
                        user: userId,
                        type: 'refund',
                        amount: booking.amount,
                        description: `Refund for cancelled monthly booking ${booking._id}`,
                        library: booking.library,
                        status: 'completed'
                    });
                    await refundTransaction.save({ session });

                    // Update booking payment status
                    booking.paymentStatus = "refunded";
                    await booking.save({ session });

                    refundTransaction.monthlyBooking = booking._id
                    await refundTransaction.save()


                    res.status(200).json({
                        success: true,
                        message: "Booking cancelled and refund processed",
                        booking,
                        refundTransaction
                    });
                    return;
                }
            }



            res.status(200).json({
                success: true,
                message: "Booking cancelled",
                booking
            });
        });
    } catch (error) {
        console.error("Error cancelling monthly booking:", error);

        const statusCode = error.statusCode || 500;
        const response = {
            success: false,
            message: error.message || "Failed to cancel booking"
        };

        if (process.env.NODE_ENV === "development") {
            response.error = error.stack;
        }

        res.status(statusCode).json(response);
    } finally {
        await session.endSession();
    }
};


