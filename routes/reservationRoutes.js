import express from 'express';
import {
  createReservation,
  getAllReservations,
  getReservationById,
  updateReservation,
  getReservationsByStudent,
  getReservationsBySeat,
  getCurrentReservations,
  cancelReservation
} from '../controllers/reservationController.js';
import { protect, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/', studentOnly, createReservation);
router.get('/', getAllReservations);
router.get('/:id', getReservationById);
router.put('/:id', updateReservation);
router.put('/:id', cancelReservation);
router.get('/student/:studentId', getReservationsByStudent);
router.get('/seat/:seatId', getReservationsBySeat);
router.get('/current/active', getCurrentReservations);

export default router;