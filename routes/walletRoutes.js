import express from "express";
import { protect, studentOnly } from "../middleware/authMiddleware.js";
import { addMoneyToWallet, getMyTransactionHistory, getMyWallet } from "../controllers/walletController.js";


const router = express.Router();

// 🔐 Protected student routes
router.post("/add-money", protect, studentOnly, addMoneyToWallet);
router.get("/my-wallet", protect, studentOnly, getMyWallet);
router.get("/my-transactions", protect, studentOnly, getMyTransactionHistory);

export default router;
