import express from 'express';
import {
  createTimeSlot,
  getAllTimeSlots,
  getTimeSlotById,
  updateTimeSlot,
  toggleTimeSlotStatus,
  deleteTimeSlot,
  addSeatsToTimeSlot,
  removeSeatsFromTimeSlot,
  getAllTimeSlotsByLibrary
} from '../controllers/timeSlotController.js';
import { protect, librarianOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllTimeSlots);
// router.get('/:id', getTimeSlotById);

// Protected librarian routes
router.use(protect);
router.use(librarianOnly);

router.get('/:libraryId/library', getAllTimeSlotsByLibrary);
router.post('/', createTimeSlot);
router.post('/:timeSlotId/add-seats', addSeatsToTimeSlot);
router.post('/:timeSlotId/remove-seats', removeSeatsFromTimeSlot);
router.put('/:id', updateTimeSlot);
router.patch('/:id/toggle-status', toggleTimeSlotStatus);
router.delete('/:id', deleteTimeSlot);

export default router;