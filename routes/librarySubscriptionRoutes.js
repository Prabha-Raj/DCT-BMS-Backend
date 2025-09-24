import express from "express";
import { protect, librarianOnly, adminOnly } from "../middleware/authMiddleware.js";
import { 
  purchaseSubscription, 
  getActiveSubscription, 
  getLibrarySubscriptions, 
  getSubscriptionsForLibrary
} from "../controllers/librarySubscriptionController.js";

const router = express.Router();

// librarian purchase subscription
router.post("/purchase", protect, librarianOnly, purchaseSubscription);
router.get("/for-library", protect, librarianOnly, getSubscriptionsForLibrary);

// get active subscription of a library
router.get("/:libraryId/active", protect, getActiveSubscription);

// get all subscriptions (history) of a library
router.get("/:libraryId/history", protect, getLibrarySubscriptions);

export default router;
