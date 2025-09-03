import express from 'express';
import { getEarningsByLibrary, getMyEarningsByLibrary } from '../controllers/earningController.js';

const router = express.Router();

// GET total earnings for a for admin
router.get('/library/:libraryId', getEarningsByLibrary);

// Get my earnings and withdraw stats for a library
router.get('/library/:libraryId/my-earnings', getMyEarningsByLibrary);

export default router;
