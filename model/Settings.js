import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    coinPrice: {
      type: Number,
      required: true,
      default: 1, // 1 coin = ₹1
    },
    walletCommission: {
      type: Number,
      required: true,
      default: 0, // in percentage or fixed
    },
    bookingCommission: {
      type: Number,
      required: true,
      default: 0, // in percentage or fixed
    },
  },
  {
    timestamps: true,
  }
);

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;
