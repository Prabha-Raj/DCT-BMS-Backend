import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      enum: ["credit", "debit", "refund"],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking"
      }
    ],
    library: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library"
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending"
    }
  },
  { 
    timestamps: true 
  }
);
const Transaction = new mongoose.model("Transaction", TransactionSchema)
export default Transaction;
