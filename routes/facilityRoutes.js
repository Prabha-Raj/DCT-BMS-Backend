import express from "express";
import { createFacility, deleteFacility, getAllFacilities, getAllFacilitiesAdmin, getFacilityById, toggleFacilityStatus, updateFacility } from "../controller/FacilityController.js";

const router = express.Router();

// Public routes
router.post("/", createFacility);
router.get("/", getAllFacilities);
router.get("/:id", getFacilityById);

// Admin routes
router.get("/admin/all", getAllFacilitiesAdmin);
router.put("/:id", updateFacility);
router.patch("/toggle-status/:id", toggleFacilityStatus);
router.delete("/:id", deleteFacility);

export default router;