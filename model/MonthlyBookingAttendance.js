import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const SessionSchema = new mongoose.Schema({
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date },
  durationMinutes: { type: Number }
}, { _id: true });

const MonthlyBookingAttendanceSchema = new mongoose.Schema({
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
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MonthlyBooking",
    required: true
  },
  date: { // day-level, unique per booking
    type: Date,
    required: true
  },
  sessions: [SessionSchema], // multiple checkin/out per day
  totalDurationMinutes: { type: Number, default: 0 }, // auto calculated
  method: { 
    type: String, 
    enum: ["QR", "manual"], 
    default: "QR",
    required: true
  }
}, {
  timestamps: true
});

// Compound unique index: ek booking ke liye ek din me ek hi doc
MonthlyBookingAttendanceSchema.index({ booking: 1, date: 1 }, { unique: true });

// Useful query indexes
MonthlyBookingAttendanceSchema.index({ student: 1, date: -1 });
MonthlyBookingAttendanceSchema.index({ library: 1, date: -1 });

// Auto-calc totalDurationMinutes before save
MonthlyBookingAttendanceSchema.pre("save", function(next) {
  if (this.sessions && this.sessions.length > 0) {
    this.totalDurationMinutes = this.sessions.reduce((acc, s) => {
      if (s.checkInTime && s.checkOutTime) {
        acc += Math.round((s.checkOutTime - s.checkInTime) / (1000 * 60));
      }
      return acc;
    }, 0);
  }
  next();
});

MonthlyBookingAttendanceSchema.plugin(mongoosePaginate);

export default mongoose.model("MonthlyBookingAttendance", MonthlyBookingAttendanceSchema);
