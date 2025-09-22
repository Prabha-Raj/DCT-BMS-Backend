import Razorpay from "razorpay";

export const getRazorpayInstance = (mode) => {
  if (mode === "live") {
    return new Razorpay({
      key_id: process.env.RAZORPAY_LIVE_KEY_ID,
      key_secret: process.env.RAZORPAY_LIVE_KEY_SECRET,
    });
  } else {
    return new Razorpay({
      key_id: process.env.RAZORPAY_TEST_KEY_ID,
      key_secret: process.env.RAZORPAY_TEST_KEY_SECRET,
    });
  }
};
