import express from "express";
import {
  forgotPassword,
  resetPassword,
  changePassword,
  verifyChangePasswordOtp
} from "../controllers/managePasswordController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔹 Forgot Password (send OTP)
router.post("/forgot-password", forgotPassword);

// 🔹 Reset Password (verify OTP)
router.post("/reset-password", resetPassword);

// 🔹 Change Password (requires login, send OTP)
router.post("/change-password", protect, changePassword);

// 🔹 Verify OTP for Change Password
router.post("/verify-change-password-otp", protect, verifyChangePasswordOtp);

export default router;
