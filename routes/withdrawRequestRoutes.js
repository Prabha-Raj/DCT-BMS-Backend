import express from 'express';
import { 
  createWithdrawRequest, 
  getAllWithdrawRequests, 
  resolveWithdrawRequest, 
  rejectWithdrawRequest,
  getMyWithdrawRequests 
} from '../controllers/withdrawRequestController.js';

const router = express.Router();

// Librarian: Create withdraw request
router.post('/', createWithdrawRequest);

// Admin: Get all withdraw requests
router.get('/', getAllWithdrawRequests);

// Admin: Resolve a withdraw request
router.patch('/:requestId/resolve', resolveWithdrawRequest);

// Admin: Reject a withdraw request
router.patch('/:requestId/reject', rejectWithdrawRequest);

// Get withdraw requests for a specific library
router.get('/library/:libraryId', getMyWithdrawRequests);

export default router;
