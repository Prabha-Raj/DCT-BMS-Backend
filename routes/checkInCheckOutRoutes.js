import express from 'express';
import { protect, studentOnly } from '../middleware/authMiddleware.js';
import { getCheckInStatus, handleCheckInOut } from '../controllers/checkInCheckOutController.js';

const router = express.Router();

// Unified check-in/check-out route
router.post('/:libraryId', protect, studentOnly, handleCheckInOut);

// Get current check-in status
router.get('/:libraryId/status', protect, studentOnly, getCheckInStatus);

export default router;