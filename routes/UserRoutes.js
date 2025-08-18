import express from 'express';
import { createUser, getAllUsers, getUserById, updateUser, deleteUser,loginUser, toggleBlockUser, verifyOtp, googleLogin, getUserProfile } from '../controllers/UserController.js';
import { adminOnly, protect, studentOnly } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();



router.post('/', createUser);
router.post('/login', loginUser);
router.post("/google-login", googleLogin);
router.post('/verify-otp', verifyOtp);
router.get('/user-profile', protect, getUserProfile);
router.put('/update', protect, studentOnly, upload.single("profileImage"), updateUser);
router.get('/', protect, adminOnly, getAllUsers); 
router.get('/:id', protect, getUserById);
router.patch('/toggle/:id', protect, adminOnly, toggleBlockUser);
router.delete('/delete/:id', protect, adminOnly, deleteUser);

export default router;