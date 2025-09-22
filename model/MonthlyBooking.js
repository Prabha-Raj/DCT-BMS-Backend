import mongoose from "mongoose";

const MonthlyBookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    timeSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeSlot",
      required: true
    },
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true
    },
    library: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "rejected"],
      default: "confirmed"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "paid"
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction"
    },
    bookedAt: {
      type: Date,
      default: Date.now,
      required: true
    }

  },
  { timestamps: true }
);

// Indexes
MonthlyBookingSchema.index({ user: 1, status: 1 });
MonthlyBookingSchema.index({ seat: 1, startDate: 1, endDate: 1 });
MonthlyBookingSchema.index({ library: 1, startDate: 1, endDate: 1 });

export default mongoose.model("MonthlyBooking", MonthlyBookingSchema);
