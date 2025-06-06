import express from "express";
import {
  createLibrary,
  getAllLibraries,
  getLibraryById,
  updateLibrary,
  deleteLibrary
} from "../controller/libraryController.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

const multiUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

router.post("/", multiUpload, createLibrary);
router.get("/", getAllLibraries);
router.get("/:id", getLibraryById);
router.put("/:id", multiUpload, updateLibrary);
router.delete("/:id", deleteLibrary);

export default router;
