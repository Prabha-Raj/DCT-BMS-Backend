import express from "express";

import {
  protect,
  adminOnly,
  librarianOnly,
  studentOnly,
} from "../middleware/authMiddleware.js";
import { getAllTransactionsAdmin, getLibraryTransactions, getMyTransactions } from "../controllers/transactionsController.js";

const router = express.Router();

// ✅ Admin - Get all transactions (with filters)
router.get("/admin", protect, adminOnly, getAllTransactionsAdmin);

// ✅ Librarian - Get transactions related to their libraries
router.get("/library", protect, librarianOnly, getLibraryTransactions);

// ✅ Student - Get their own transactions
router.get("/my", protect, studentOnly, getMyTransactions);

export default router;
