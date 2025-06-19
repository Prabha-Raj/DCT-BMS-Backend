import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time format (HH:MM)`
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time format (HH:MM)`
      }
    },
    price:{
      type:String,
    },
    bookings: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      },
      bookedAt: {
        type: Date,
        default: Date.now
      }
    }],
    isBooked: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { _id: true }
);

const SeatSchema = new mongoose.Schema(
  {
    library: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
    },
    seatNumber: {
      type: String,
      required: true,
    },
    seatName: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    timeSlots: [timeSlotSchema],
  },
  { timestamps: true }
);

SeatSchema.index({ library: 1, seatNumber: 1 }, { unique: true });

// Update isBooked status based on active bookings
SeatSchema.methods.updateSlotBookingStatus = function(slotId) {
  const slot = this.timeSlots.id(slotId);
  if (!slot) return false;
  
  slot.isBooked = slot.bookings.some(b => b.isActive);
  return slot.isBooked;
};

// Add validation to ensure no overlapping time slots
SeatSchema.pre('save', function(next) {
  if (this.isModified('timeSlots')) {
    // Sort time slots by start time
    const sortedSlots = [...this.timeSlots].sort((a, b) => 
      a.startTime.localeCompare(b.startTime)
    );
    
    // Check for overlaps
    for (let i = 1; i < sortedSlots.length; i++) {
      if (sortedSlots[i-1].endTime > sortedSlots[i].startTime) {
        throw new Error(`Time slots overlap: ${sortedSlots[i-1].startTime}-${sortedSlots[i-1].endTime} and ${sortedSlots[i].startTime}-${sortedSlots[i].endTime}`);
      }
    }
    
    // Update all slots' isBooked status
    this.timeSlots.forEach(slot => {
      slot.isBooked = slot.bookings.some(b => b.isActive);
    });
  }
  next();
});

const Seat = mongoose.model("Seat", SeatSchema);
export default Seat;