import express from "express";
import { protect, adminOnly, librarianOnly, studentOnly } from "../middleware/authMiddleware.js";
import { adminStats, librarianStats, studentStats } from "../controllers/dashboardStatsController.js";

const router = express.Router();

// Admin dashboard route
router.get("/admin", protect, adminOnly, adminStats);

// Librarian dashboard route
router.get("/librarian", protect, librarianOnly, librarianStats);

// Student dashboard route
router.get("/student", protect, studentOnly, studentStats);

export default router;