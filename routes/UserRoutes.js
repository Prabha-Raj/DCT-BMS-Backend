import express from 'express';
import { createUser, getAllUsers, getUserById, updateUser, deleteUser,loginUser, toggleBlockUser, verifyOtp, googleLogin } from '../controllers/UserController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', createUser);
router.post('/login', loginUser);
router.post("/google-login", googleLogin);
router.post('/verify-otp', verifyOtp);
router.get('/:id', protect, getUserById);
router.put('/update/:id', protect, updateUser);
router.get('/', protect, adminOnly, getAllUsers); 
router.patch('/toggle/:id', protect, adminOnly, toggleBlockUser);
router.delete('/delete/:id', protect, adminOnly, deleteUser);

export default router;