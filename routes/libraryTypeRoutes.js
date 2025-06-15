import express from "express";
import { createLibraryType, deleteLibraryType, getAllLibraryTypes, getAllLibraryTypesAdmin, getLibraryTypeById, toggleLibraryTypeStatus, updateLibraryType } from "../controllers/LibraryTypeController.js";

const router = express.Router();

// Public routes
router.get("/", getAllLibraryTypes);
router.get("/:id", getLibraryTypeById);
router.post("/", createLibraryType);

// Admin routes
router.get("/admin/all", getAllLibraryTypesAdmin);
router.put("/:id", updateLibraryType);
router.patch("/toggle-status/:id", toggleLibraryTypeStatus); // Single toggle endpoint
router.delete("/:id", deleteLibraryType);

export default router;