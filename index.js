import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ConnectDB from "./config/Db.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import inquiryRoutes from "./routes/inquiryRoutes.js";
import UserRoutes from "./routes/UserRoutes.js";
import libraryTypeRoutes from "./routes/libraryTypeRoutes.js";
import facilityRoutes from "./routes/facilityRoutes.js";
import seatRoutes from "./routes/seatRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";


const app = express();
dotenv.config();

// Database connection
ConnectDB();

// Required for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/users", UserRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/library-type", libraryTypeRoutes);
app.use("/api/facility", facilityRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/seat", seatRoutes);
app.use("/api/reservation", reservationRoutes);

// Start Server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server is live on port: ${PORT}`);
});
