import express from "express";
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  toggleActiveStatus,
  getAllSubscriptionsForAdmin,

} from "../controllers/subscriptionController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/", protect, adminOnly, createSubscription);
router.get("/for-admin", protect, adminOnly, getAllSubscriptionsForAdmin);
router.get("/", getSubscriptions);
router.get("/:id", getSubscriptionById);
router.put("/:id", protect, adminOnly, updateSubscription);
router.patch("/toggle-status/:id",   protect, adminOnly, toggleActiveStatus);


export default router;
