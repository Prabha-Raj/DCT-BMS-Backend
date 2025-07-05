import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: "coin"
    }
  },
  { 
    timestamps: true 
  }
);

// Prevent negative balance
WalletSchema.pre('save', function(next) {
  if (this.balance < 0) {
    throw new Error('Balance cannot be negative');
  }
  next();
});

export default mongoose.model("Wallet", WalletSchema);