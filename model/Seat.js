import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

SeatSchema.index({ library: 1, seatNumber: 1 }, { unique: true });

const Seat = mongoose.model("Seat", SeatSchema);
export default Seat;