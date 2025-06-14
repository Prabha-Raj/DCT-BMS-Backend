import express from "express";
import {
  createLibrary,
  getLibraryById,
  updateLibrary,
  deleteLibrary,
  getAllLibrariesForStudents,
  getAllLibrariesForAdmin,
  toggleBlockLibrary,
  togglePopularLibrary
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

router.get("/for-admin", getAllLibrariesForAdmin);
router.get("/for-students", getAllLibrariesForStudents);
router.patch("/block/:id/toggle", toggleBlockLibrary);
router.patch("/popular/:id/toggle", togglePopularLibrary);
router.get("/:id", getLibraryById);
router.put("/:id", multiUpload, updateLibrary);
router.delete("/:id/delete", deleteLibrary);

export default router;