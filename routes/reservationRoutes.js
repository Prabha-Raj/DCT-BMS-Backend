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

const router = express.Router();

router.post('/', createReservation);
router.get('/', getAllReservations);
router.get('/:id', getReservationById);
router.put('/:id', updateReservation);
router.put('/:id', cancelReservation);
router.get('/student/:studentId', getReservationsByStudent);
router.get('/seat/:seatId', getReservationsBySeat);
router.get('/current/active', getCurrentReservations);

export default router;