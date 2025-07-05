import express from "express";
import { getSetting, upsertSetting } from "../controllers/settingController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getSetting);            // Any logged-in user
router.post("/", protect, adminOnly, upsertSetting); // Admin only

export default router;
