import express from 'express';
import { 
  getAllMonthlyAttendances, 
  getDailyAttendance, 
  getMyMonthlyAttendances, 
  monthlyCheckIn, 
  monthlyCheckOut 
} from '../controllers/MonthlyBookingAttendanceController.js';
import { protect, adminOnly, librarianOnly, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Check-in/Check-out endpoints (Student only)
router.post('/:libraryId/bookings/:bookingId/checkin', protect, studentOnly, monthlyCheckIn);
router.post('/:libraryId/bookings/:bookingId/checkout', protect, studentOnly, monthlyCheckOut);

// Student attendance endpoints
router.get('/my-attendances', protect, studentOnly, getMyMonthlyAttendances);
router.get('/daily/:date', protect, studentOnly, getDailyAttendance);

// Admin endpoints
router.get('/admin/attendances', protect, adminOnly, getAllMonthlyAttendances);
router.get('/admin/students/:studentId/attendances', protect, adminOnly, getAllMonthlyAttendances);

// Librarian endpoints
router.get('/librarian/:libraryId/attendances', protect, librarianOnly, getAllMonthlyAttendances);
router.get('/librarian/:libraryId/students/:studentId/attendances', protect, librarianOnly, getAllMonthlyAttendances);

export default router;