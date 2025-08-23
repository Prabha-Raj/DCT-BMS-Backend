import express from 'express';
import {
    createSeat,
    getAllSeats,
    getSeatById,
    updateSeat,
    deleteSeat,
    toggleSeatStatus,
    getSeatsByLibrary,
    bulkCreateSeats,
    getSeatDetails,
    addTimeSlotsForASeat,
    getMonthlySeatCompleteDetails,
    checkSeatAvailability
} from '../controllers/SeatController.js';
import { librarianOnly, protect, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// public route
router.post('/check-availability', checkSeatAvailability);

// Apply protect middleware to all routes
router.use(protect);

// Seat management routes
router.post('/', librarianOnly, createSeat);
router.post('/bulk', librarianOnly, bulkCreateSeats);
router.get('/', getAllSeats);
router.get('/:id', getSeatById);
router.get('/:id/details', getSeatDetails);
router.get('/:id/mb/details/for-librarian', getMonthlySeatCompleteDetails);
router.put('/update/:id', librarianOnly, updateSeat);
router.post('/:id/time-slots', librarianOnly,addTimeSlotsForASeat);
router.delete('/:id', librarianOnly, deleteSeat);
router.patch('/:id/toggle-status', librarianOnly, toggleSeatStatus);
router.get('/library/:libraryId', getSeatsByLibrary);


export default router;