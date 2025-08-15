import express from 'express';
import {
  // createBooking,
  getUserBookings,
  getLibraryBookings,
  updateBookingStatus,
  cancelBooking,
  getAllBookings,
  getBookingsByLibraryId,
  getBookingsByLibraryAndUser
} from '../controllers/bookingController.js';
import { protect, studentOnly, librarianOnly, adminOnly } from '../middleware/authMiddleware.js';
import { createBooking } from '../controllers/bookingControllerNew.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(studentOnly, createBooking)
  .get(adminOnly, getAllBookings);

  
router.get('/my-bookings', studentOnly, getUserBookings);
router.route('/:libraryId/today')
  .get(studentOnly, getBookingsByLibraryAndUser);

router.patch('/:id/cancel', studentOnly, cancelBooking);

router.route('/library')
  .get(librarianOnly, getLibraryBookings);

router.route('/:libraryId/library')
  .get(adminOnly, getBookingsByLibraryId);


router.route('/:id/status')
  .put(librarianOnly, updateBookingStatus);


export default router;