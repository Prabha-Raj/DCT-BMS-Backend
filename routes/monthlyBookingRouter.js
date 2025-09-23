import express from 'express';
import { 
  createMonthlyBooking, 
  getMyMonthlyBookings, 
  cancelMonthlyBooking, 
  getMonthlyBookingsForLibrarian,
  getMonthlyBookingsForAdmin
} from '../controllers/monthlyBookingController.js';
import { adminOnly, librarianOnly, protect, studentOnly } from '../middleware/authMiddleware.js';
import { newCreateMonthlyBooking } from '../controllers/newMonthlyBookingController.js';

const router = express.Router();

router.use()

router.post('/',protect, studentOnly, createMonthlyBooking);
router.post('/create/:userId', newCreateMonthlyBooking);
router.get('/',protect, adminOnly, getMonthlyBookingsForAdmin);
router.get('/student/my-booking',protect, studentOnly, getMyMonthlyBookings);
router.get('/librarian/my-booking',protect, librarianOnly, getMonthlyBookingsForLibrarian);
router.patch('/:bookingId/cancel',protect, studentOnly, cancelMonthlyBooking);

export default router;