import express from 'express';
import { upsertBankDetails, getBankDetailsById } from '../controllers/bankDetailsController.js';

const router = express.Router();

// Add or update bank details for a library
router.post('/library/:libraryId', upsertBankDetails);

// Get bank details by library ID
router.get('/library/:libraryId', getBankDetailsById);

export default router;
