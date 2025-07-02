import express from "express";
import { protect, adminOnly, librarianOnly, studentOnly } from "../middleware/authMiddleware.js";
import { checkIn, checkOut, getAllAttendances, getLibraryAttendances, getMyAttendances } from "../controllers/AttendanceController.js";

const router = express.Router();

// Student routes
router.get("/my-attendances/:studentId", protect, studentOnly, getMyAttendances);
router.post("/:libraryId/check-in/:bookingId", protect, studentOnly, checkIn);
router.post("/:libraryId/check-out/:bookingId", protect, studentOnly, checkOut);

// Librarian routes
router.get("/library", protect, librarianOnly, getLibraryAttendances);

// Admin routes
router.get("/", protect, adminOnly, getAllAttendances);

export default router;