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

// Configure Multer for multiple file uploads
const multiUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 }
]);

// Add debug middleware to log incoming requests
router.post("/create", (req, res, next) => {
  console.log("Incoming request body:", req.body);
  next();
}, multiUpload, (req, res, next) => {
  console.log("Uploaded files:", req.files);
  next();
}, createLibrary);

router.get("/", getAllLibraries);
router.get("/:id", getLibraryById);
router.put("/:id", multiUpload, updateLibrary);
router.delete("/:id", deleteLibrary);

export default router;