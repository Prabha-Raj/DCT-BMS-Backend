import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    index: true,
  },
  planName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  durationInMonths: {
    type: Number,
    required: true,
  },
  features: [
    {
      type: String,
    }
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
