import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema({
  library: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Library",
    required: true
  },
  type: {
    type: String,
    enum: ["hourly", "weekly", "monthly", "yearly"],
    required: true
  },
  pricePerHour: {
    type: Number,
    required: true
  },
  totalHoursAllowed: {
    type: Number,
    required: true
  },
  dailyHourLimit: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
},{ timestamps:true });

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
