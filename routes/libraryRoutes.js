import express from "express";
import {
  createLibrary,
  getLibraryById,
  updateLibrary,
  deleteLibrary,
  getAllLibrariesForStudents,
  getAllLibrariesForAdmin,
  toggleBlockLibrary,
  togglePopularLibrary,
  getLibrariesByAddress,
  getMyLibrary,
  getNearestLibrariesByPinCode,
  getNearestLibrariesByLatLon,
  getLibraryQRCode,
  updateLibraryStatus,
  getAllLibrariesForMonthlyBooking,
  getNearMeLibrariesForMonthlyBookingLatLon
} from "../controllers/libraryController.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { adminOnly, librarianOnly, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Configure Multer for multiple file uploads
const multiUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 }
]);

// Add debug middleware to log incoming requests
router.post("/create", (req, res, next) => {
  next();
}, multiUpload, (req, res, next) => {
  next();
}, createLibrary);

router.get("/for-admin", protect, adminOnly,getAllLibrariesForAdmin);
router.get("/for-students", getAllLibrariesForStudents);
router.get('/search', getLibrariesByAddress);
router.get("/for-monthly-booking", getAllLibrariesForMonthlyBooking);
router.get('/nearme', getNearestLibrariesByLatLon);
router.get('/nearme/for-monthly-booking', getNearMeLibrariesForMonthlyBookingLatLon);
router.get('/qr-code', protect, librarianOnly, getLibraryQRCode);
router.get('/:pincode/nearest', getNearestLibrariesByPinCode);
router.get("/my-library", protect, librarianOnly, getMyLibrary);
router.get("/:id", getLibraryById);
router.put("/update/:id", protect, librarianOnly, multiUpload, updateLibrary);
router.patch("/block/:id/toggle", protect, adminOnly, toggleBlockLibrary);
router.patch("/popular/:id/toggle", protect, adminOnly, togglePopularLibrary);
router.patch("/:id/status", protect, adminOnly, updateLibraryStatus);
router.delete("/:id/delete", protect, adminOnly, deleteLibrary);


export default router;