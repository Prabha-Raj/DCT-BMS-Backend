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

router.use(protect)

router.post('/', studentOnly, createMonthlyBooking);
router.post('/create', studentOnly, newCreateMonthlyBooking);
router.get('/', adminOnly, getMonthlyBookingsForAdmin);
router.get('/student/my-booking', studentOnly, getMyMonthlyBookings);
router.get('/librarian/my-booking', librarianOnly, getMonthlyBookingsForLibrarian);
router.patch('/:bookingId/cancel', studentOnly, cancelMonthlyBooking);

export default router;