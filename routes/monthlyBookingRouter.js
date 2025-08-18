import express from 'express';
import { 
  createMonthlyBooking, 
  getMyMonthlyBookings, 
  cancelMonthlyBooking 
} from '../controllers/monthlyBookingController.js';
import { protect, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect)

router.post('/', studentOnly, createMonthlyBooking);
router.get('/', studentOnly, getMyMonthlyBookings);
router.patch('/:bookingId/cancel', studentOnly, cancelMonthlyBooking);

export default router;