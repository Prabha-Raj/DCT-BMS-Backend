import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const AttendanceSchema = new mongoose.Schema({
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
    ref: "Booking"
  },
  timeSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TimeSlot"
  },
  checkInTime: {
    type: Date,
    required: true
  },
  checkOutTime: Date,
  durationMinutes: Number,
  method: { 
    type: String, 
    enum: ["QR", "manual"], 
    default: "QR",
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Indexes for better query performance
AttendanceSchema.index({ student: 1 });
AttendanceSchema.index({ library: 1 });
AttendanceSchema.index({ checkInTime: -1 });
AttendanceSchema.index({ student: 1, checkInTime: -1 });
AttendanceSchema.index({ library: 1, checkInTime: -1 });
AttendanceSchema.plugin(mongoosePaginate);
export default mongoose.model("Attendance", AttendanceSchema);