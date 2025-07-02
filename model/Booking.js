import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true
    },
    timeSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeSlot",
      required: true
    },
    library: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
    },
    bookingDate: {
      type: Date,
      required: true,
      get: function(val) {
        // Return only date part in YYYY-MM-DD format
        return val ? val.toISOString().split('T')[0] : val;
      },
      set: function(val) {
        // Store as UTC midnight
        const date = new Date(val);
        return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      }
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "rejected"],
      default: "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction"
    },
    cancelledAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    amount: {
      type: Number,
      required: true
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      getters: true
    },
    toObject: { 
      virtuals: true,
      getters: true
    }
  }
);

// Indexes
BookingSchema.index({ user: 1, status: 1 });
BookingSchema.index({ seat: 1, bookingDate: 1 });
BookingSchema.index({ library: 1, bookingDate: 1 });
BookingSchema.index({ timeSlot: 1, bookingDate: 1 });

// Virtual for cancellation window
BookingSchema.virtual('canCancel').get(function() {
  const now = new Date();
  const bookingTime = new Date(this.bookingDate);
  const oneHourBefore = new Date(bookingTime.getTime() - (60 * 60 * 1000));
  return now < oneHourBefore && this.status === 'confirmed';
});

export default mongoose.model("Booking", BookingSchema);