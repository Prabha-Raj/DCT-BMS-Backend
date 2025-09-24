import mongoose from "mongoose";

const librarySubscriptionSchema = new mongoose.Schema({
  library: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Library",
    required: true,
  },
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
    required: true,
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Automatically check expiry before save
librarySubscriptionSchema.pre("save", function(next) {
  if (this.purchaseDate && this.subscriptionPlan?.durationInMonths) {
    const expiry = new Date(this.purchaseDate);
    expiry.setMonth(expiry.getMonth() + this.subscriptionPlan.durationInMonths);
    this.expiryDate = expiry;
  }
  next();
});

const LibrarySubscription = mongoose.model("LibrarySubscription", librarySubscriptionSchema);
export default LibrarySubscription;
