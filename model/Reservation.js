import mongoose from "mongoose";

const ReservationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    library: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
    },
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true
    },
    timeSlot: {
      type: {
        _id: mongoose.Schema.Types.ObjectId,
        startTime: String,
        endTime: String
      },
      required: true
    },
    bookingRef: {
      type: mongoose.Schema.Types.ObjectId  // Reference to booking in Seat.timeSlots.bookings
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function(v) {
          return v >= this.startDate;
        },
        message: props => `End date (${props.value}) must be after or same as start date (${this.startDate})`
      }
    },
    qrCode: {
      type: String
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "completed", "no-show"],
      default: "active"
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
ReservationSchema.index({ seat: 1, startDate: 1, endDate: 1, "timeSlot._id": 1 });
ReservationSchema.index({ bookingRef: 1 }, { unique: true, sparse: true });

// Validation to ensure timeSlot exists in referenced seat
ReservationSchema.pre('save', async function(next) {
  try {
    if (this.isModified('seat') || this.isModified('timeSlot._id')) {
      const seat = await mongoose.model('Seat').findById(this.seat);
      if (!seat) {
        throw new Error('Referenced seat does not exist');
      }
      
      const timeSlot = seat.timeSlots.id(this.timeSlot._id);
      if (!timeSlot) {
        throw new Error('Referenced timeSlot does not exist in the seat');
      }
      
      // Sync time slot details
      this.timeSlot.startTime = timeSlot.startTime;
      this.timeSlot.endTime = timeSlot.endTime;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Clean up booking reference when reservation is removed
ReservationSchema.post('remove', async function(doc) {
  try {
    await mongoose.model('Seat').updateOne(
      { _id: doc.seat, "timeSlots._id": doc.timeSlot._id },
      { 
        $pull: { "timeSlots.$.bookings": { _id: doc.bookingRef } },
        $set: { 
          "timeSlots.$.isBooked": false,
          "timeSlots.$.bookedBy": null 
        }
      }
    );
  } catch (error) {
    console.error("Error cleaning up booking reference:", error);
  }
});

export default mongoose.model("Reservation", ReservationSchema);