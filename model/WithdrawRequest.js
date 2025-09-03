import mongoose from "mongoose";

const WithdrawRequestSchema = new mongoose.Schema({
  library: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Library",
    required: true
  },
  requestedAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "resolved", "rejected"],
    default: "pending"
  },
  rejectedReason: {
    type: String,
    default: null
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  }
});

export default mongoose.model("WithdrawRequest", WithdrawRequestSchema);
