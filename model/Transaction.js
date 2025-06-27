import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
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

    // Context for seat booking
    library: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library"
    },
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat"
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId
    },

    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Transaction", transactionSchema);
