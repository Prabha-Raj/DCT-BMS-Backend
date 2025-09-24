import crypto from "crypto";
import { getRazorpayInstance } from "../config/razorpay.js";

// ✅ Create Order with Mode
export const createOrder = async (req, res) => {
  try {
    const { amount, mode } = req.query;

    if (!amount || !mode) {
      return res.status(400).json({ error: "amount and mode are required" });
    }

    const razorpay = getRazorpayInstance(mode);

    const options = {
      amount: Number(amount) * 100, // paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    const key_id =
      mode === "live"
        ? process.env.RAZORPAY_LIVE_KEY_ID
        : process.env.RAZORPAY_TEST_KEY_ID;

    res.json({
      token: order.id,
      key: key_id,
      mode,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Verify Payment
export const verifyPayment = (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, mode } = req.body;

    if (!mode) {
      return res.status(400).json({ error: "mode is required" });
    }

    const secret =
      mode === "live"
        ? process.env.RAZORPAY_LIVE_KEY_SECRET
        : process.env.RAZORPAY_TEST_KEY_SECRET;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      return res.json({ status: "success", message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ status: "failed", message: "Invalid signature" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
