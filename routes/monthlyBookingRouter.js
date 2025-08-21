import express from 'express';
import { 
  createMonthlyBooking, 
  getMyMonthlyBookings, 
  cancelMonthlyBooking, 
  getMonthlyBookingsForLibrarian
} from '../controllers/monthlyBookingController.js';
import { librarianOnly, protect, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect)

router.post('/', studentOnly, createMonthlyBooking);
router.get('/student/my-booking', studentOnly, getMyMonthlyBookings);
router.get('/librarian/my-booking', librarianOnly, getMonthlyBookingsForLibrarian);
router.patch('/:bookingId/cancel', studentOnly, cancelMonthlyBooking);

export default router;