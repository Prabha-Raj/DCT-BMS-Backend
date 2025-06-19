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
    addTimeSlots,
    getTimeSlots,
    bookTimeSlot,
    deleteTimeSlot,
    updateTimeSlot,
    toggleTimeSlotActive
} from '../controllers/SeatController.js';
import { librarianOnly, protect, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Seat management routes
router.post('/', librarianOnly, createSeat);
router.post('/bulk', librarianOnly, bulkCreateSeats);
router.get('/', getAllSeats);
router.get('/get-one/:id', getSeatById);
router.put('/update/:id', librarianOnly, updateSeat);
router.delete('/delete/:id', librarianOnly, deleteSeat);
router.patch('/:id/toggle-status', librarianOnly, toggleSeatStatus);
router.get('/library/:libraryId', getSeatsByLibrary);

// Time slot management routes
router.post('/:id/time-slots', librarianOnly, addTimeSlots);
router.get('/:id/time-slots', getTimeSlots);
router.post('/:id/time-slots/:slotId/book', studentOnly, bookTimeSlot); // Note: This might need protection
router.put('/:id/time-slots/:slotId', librarianOnly, updateTimeSlot);
router.put('/:id/toggle-time-slots/:slotId', librarianOnly, toggleTimeSlotActive);
router.delete('/:id/time-slots/:slotId', librarianOnly, deleteTimeSlot);

export default router;