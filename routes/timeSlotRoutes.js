import express from 'express';
import {
  createTimeSlot,
  getAllTimeSlots,
  getTimeSlotById,
  updateTimeSlot,
  toggleTimeSlotStatus,
  deleteTimeSlot
} from '../controllers/timeSlotController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllTimeSlots);
router.get('/:id', getTimeSlotById);

// Protected admin routes
router.use(protect);
router.use(adminOnly);

router.post('/', createTimeSlot);
router.put('/:id', updateTimeSlot);
router.patch('/:id/toggle-status', toggleTimeSlotStatus);
router.delete('/:id', deleteTimeSlot);

export default router;