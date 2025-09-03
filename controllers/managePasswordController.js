import bcrypt from "bcryptjs";
import { sendMail } from "../utils/mailer.js";
import User from "../model/User.js";
import { Otp } from "../model/Otp.js";

// 🔹 Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: "This email is not registered. Please check and try again or sign up for a new account." });

    // Delete old OTPs for this email
    await Otp.deleteMany({ email });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 min expiry
    });

    const mailSent = await sendMail(
      email,
      "Password Reset OTP",
      `Your OTP for resetting password is ${otp}. It is valid for 10 minutes.`
    );

  if (!mailSent) return res.status(500).json({ success: false, message: "Unable to send OTP email at the moment. Please try again later." });

  res.json({ success: true, message: "An OTP has been sent to your email address. Please check your inbox and spam folder." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Verify OTP & Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const record = await Otp.findOne({ email, otp });

    if (!record) {
      // OTP not found (invalid)
      return res.status(400).json({ success: false, type: "invalid", message: "The OTP you entered is incorrect. Please check and try again." });
    }
    if (record.expiresAt < new Date()) {
      // OTP expired
      return res.status(400).json({ success: false, type: "expired", message: "Your OTP has expired. Please request a new OTP to reset your password." });
    }

    const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: "No user found for this email address." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await Otp.deleteMany({ email });

    await sendMail(
      email,
      "Password Changed Successfully",
      `Your password has been updated successfully. If this wasn't you, contact support immediately.`
    );

  res.json({ success: true, message: "Your password has been reset successfully. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Change Password (logged-in user)
export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: "User not found. Please log in again or contact support if the issue persists." });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) return res.status(401).json({ success: false, message: "The current password you entered is incorrect. Please try again." });

    // Delete old OTPs for this email
    await Otp.deleteMany({ email: user.email });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.create({
      email: user.email,
      otp,
      newPassword, // store new password temporarily until OTP verified
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    await sendMail(
      user.email,
      "Password Change OTP",
      `Your OTP to confirm password change is ${otp}.`
    );

  res.json({ success: true, message: "An OTP has been sent to your email. Please enter the OTP to confirm your password change." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Verify OTP for Change Password
export const verifyChangePasswordOtp = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otp } = req.body;

    const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: "User not found. Please log in again or contact support if the issue persists." });

    const record = await Otp.findOne({ email: user.email, otp });
    if (!record) {
      // OTP not found (invalid)
      return res.status(400).json({ success: false, type: "invalid", message: "The OTP you entered is incorrect. Please check and try again." });
    }
    if (record.expiresAt < new Date()) {
      // OTP expired
      return res.status(400).json({ success: false, type: "expired", message: "Your OTP has expired. Please request a new OTP to change your password." });
    }

    user.password = await bcrypt.hash(record.newPassword, 10);
    await user.save();

    await Otp.deleteMany({ email: user.email });

  res.json({ success: true, message: "Your password has been changed successfully. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
