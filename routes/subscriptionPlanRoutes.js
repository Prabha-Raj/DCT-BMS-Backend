import express from "express";
import {
  createSubscriptionPlan,
  getMySubscriptionPlans,
  getAllActivePlans,
  getPlansByLibraryId,
  togglePlanStatus,
  deletePlan
} from "../controllers/SubscriptionPlanController.js";
import { protect, librarianOnly, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Librarian: Create & view own plans
router.post("/", protect, librarianOnly, createSubscriptionPlan);
router.get("/my", protect, librarianOnly, getMySubscriptionPlans);

// Public/Student routes
router.get("/active", getAllActivePlans);
router.get("/library/:libraryId", getPlansByLibraryId);

// Admin/Librarian: toggle or delete
router.patch("/:planId/toggle", protect, librarianOnly, togglePlanStatus);
router.delete("/:planId", protect, librarianOnly, deletePlan);

export default router;
