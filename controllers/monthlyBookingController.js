import mongoose from "mongoose";
import MonthlyBooking from "../model/MonthlyBooking.js";
import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";
import Library from "../model/LibraryModel.js";
import Seat from "../model/Seat.js";
import User from "../model/User.js";
import Setting from "../model/Settings.js";

const checkMonthlyBookingConflicts = async (seatId, startDate, endDate, session) => {
    const existingBookings = await MonthlyBooking.find({
        seat: seatId,
        $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
        ],
        status: { $in: ["confirmed", "pending"] }
    }).session(session);

    return existingBookings.length > 0;
};

export const createMonthlyBooking = async (req, res) => {
    const session = await mongoose.startSession();
    let transactionInProgress = true;

    try {
        await session.withTransaction(async () => {
            try {
                // 1. Input validation
                const { seat, library, from } = req.body;
                const userId = req.user._id;

                if (!seat || !library) {
                    throw { statusCode: 400, message: "Seat and library IDs are required", isOperational: true };
                }

                // 2. Fetch data
                const [seatData, libraryData, user, wallet] = await Promise.all([
                    Seat.findById(seat).session(session),
                    Library.findById(library).session(session),
                    User.findById(userId).session(session),
                    Wallet.findOne({ user: userId }).session(session)
                ]);

                // 3. Validate resources
                if (!seatData || !libraryData || !user || !wallet) {
                    const missingResource = !seatData ? "Seat" :
                        !libraryData ? "Library" :
                            !user ? "User" : "Wallet";
                    throw {
                        statusCode: 404,
                        message: `${missingResource} not found`,
                        isOperational: true
                    };
                }

                // 4. Business validations
                if (seatData.library.toString() !== library) {
                    throw {
                        statusCode: 400,
                        message: "Seat doesn't belong to specified library",
                        isOperational: true
                    };
                }
                const commission = await Setting.findOne()
                const bookingCommission = commission?.bookingCommission || 0
                // console.log(commission, bookingCommission)
                const amount = libraryData.monthlyFee + bookingCommission;
                if (amount <= 0) {
                    throw {
                        statusCode: 400,
                        message: "Monthly booking not available for this library",
                        isOperational: true
                    };
                }

                if (wallet.balance < amount) {
                    throw {
                        statusCode: 400,
                        message: "Insufficient wallet balance",
                        isOperational: true
                    };
                }


                // Hamesha Date banalo
                let fromDate = from ? new Date(from) : new Date();

                // Invalid date check (safety)
                if (isNaN(fromDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format"
                    });
                }

                // Start date = same din ka 00:00:00
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 30);
                endDate.setHours(23, 59, 59, 999);

                if (await checkMonthlyBookingConflicts(seat, startDate, endDate, session)) {
                    throw {
                        statusCode: 409,
                        message: "Seat already booked for the requested period",
                        isOperational: true
                    };
                }

                // 6. Process transaction
                wallet.balance -= amount;
                await wallet.save({ session });

                const transaction = new Transaction({
                    wallet: wallet._id,
                    user: userId,
                    type: 'debit',
                    amount,
                    description: `Monthly booking at ${libraryData.libraryName}`,
                    library,
                    status: 'completed'
                });
                await transaction.save({ session });

                const monthlyBooking = new MonthlyBooking({
                    user: userId,
                    seat,
                    library,
                    startDate,
                    endDate,
                    amount,
                    status: "confirmed",
                    paymentStatus: "paid",
                    paymentId: transaction._id,
                    bookedAt: new Date()
                });
                await monthlyBooking.save({ session });

                transaction.monthlyBooking = monthlyBooking._id;
                await transaction.save({ session });

                // 7. Success response
                transactionInProgress = false;
                const populatedBooking = await MonthlyBooking.findById(monthlyBooking._id)
                    .populate("user", "name email")
                    .populate("seat", "seatNumber floor")
                    .populate("library", "libraryName location")
                    .populate("paymentId", "amount status createdAt")
                    .session(session);

                res.status(201).json({
                    success: true,
                    data: {
                        booking: populatedBooking,
                        transaction: {
                            id: transaction._id,
                            amount: transaction.amount,
                            status: transaction.status
                        }
                    }
                });

            } catch (innerError) {
                // Mark transaction as failed
                transactionInProgress = false;
                throw innerError; // Re-throw to trigger outer catch
            }
        });
    } catch (error) {
        // Handle transaction errors safely
        if (transactionInProgress) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error("Failed to abort transaction:", abortError);
            }
        }

        // Prepare error response
        const statusCode = error.statusCode || 500;
        const response = {
            success: false,
            message: error.message || "Booking creation failed",
            ...(error.isOperational ? {} : { systemError: "Internal server error" })
        };

        // Development-only details
        if (process.env.NODE_ENV === "development") {
            response.errorDetails = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        res.status(statusCode).json(response);
    } finally {
        try {
            await session.endSession();
        } catch (sessionError) {
            console.error("Failed to end session:", sessionError);
        }
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
            message: "These are your monthly bookings",
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


// Get user's monthly bookings
export const getMonthlyBookingsForLibrarian = async (req, res) => {
    try {
        const user = req.user._id;
        console.log(user)
        const { status, } = req.query;

        const library = await Library.findOne({ librarian: user })
        if (!library) {
            return res.status(404).json({
                success: false,
                message: "Your library not found"
            })
        }

        const filter = { library: library._id };
        if (status) filter.status = status;

        const bookings = await MonthlyBooking.find(filter)
            .populate('seat')
            .populate('library')
            .populate('paymentId')
            .sort({ bookingDate: -1 })

        res.status(200).json({
            success: true,
            message: "These are your monthly bookings",
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

// Get user's monthly bookings for admin
export const getMonthlyBookingsForAdmin = async (req, res) => {
    try {
        const { status, } = req.query;

        const filter = { };
        if (status) filter.status = status;

        const bookings = await MonthlyBooking.find(filter)
            .populate('user')
            .populate('seat')
            .populate('library')
            .populate('paymentId', "-bookings")
            
            .sort({ bookingDate: -1 })

        res.status(200).json({
            success: true,
            message: "These are your monthly bookings",
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


