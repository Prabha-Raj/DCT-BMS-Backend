import express from 'express';
import { createUser, getAllUsers, getUserById, updateUser, deleteUser,loginUser } from '../controller/UserController.js';

const router = express.Router();

router.post('/', createUser);
router.post('/login', loginUser);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;