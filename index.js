import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http"; 
import { setupSocket } from "./socket/socketConfig.js"; 

import ConnectDB from "./config/Db.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import inquiryRoutes from "./routes/inquiryRoutes.js";
import userRoutes from "./routes/UserRoutes.js";
import libraryTypeRoutes from "./routes/libraryTypeRoutes.js";
import facilityRoutes from "./routes/facilityRoutes.js";
import seatRoutes from "./routes/seatRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import timeSlotRoutes from "./routes/timeSlotRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import monthlyBookingRoutes from "./routes/monthlyBookingRouter.js";
import monthlyBookingAttendanceRoutes from "./routes/MonthlyBookingAttendanceRoutes.js";
import checkInOutRoutes from "./routes/checkInCheckOutRoutes.js";
import startBookingStatusCron from "./utils/BookingStatusCronJob.js";
import earningRoutes from "./routes/earningRoutes.js";
import bankDetailsRoutes from "./routes/bankDetailsRoutes.js";
import withdrawRequestRoutes from "./routes/withdrawRequestRoutes.js";
import managePasswordRoutes from "./routes/managePasswordRoutes.js";
import subdcriptionRoutes from "./routes/subscriptionRoutes.js";



const app = express();
dotenv.config();

// Database connection
ConnectDB();

// Required for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Allowed Origins from .env
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

// Middlewares
app.use(express.json());

// ✅ Custom CORS setup
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin (e.g. Postman, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Always trust first proxy (safe for both local + production)
app.set("trust proxy", 1);

// Routes
app.use("/api/users", userRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/library-type", libraryTypeRoutes);
app.use("/api/facility", facilityRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/seat", seatRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/timeslot", timeSlotRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/stats", dashboardRoutes);
app.use("/api/setting", settingRoutes);
app.use("/api/monthly-booking", monthlyBookingRoutes);
app.use("/api/mb/attendance", monthlyBookingAttendanceRoutes);
app.use("/api/checkinout", checkInOutRoutes);
app.use("/api/earnings", earningRoutes);
app.use("/api/bank-details", bankDetailsRoutes);
app.use("/api/withdraw-requests", withdrawRequestRoutes);
app.use("/api/password", managePasswordRoutes);
app.use("/api/subscriptions", subdcriptionRoutes);



app.get("/", (req, res) => {
  res.send("Backend of BookMySpace is running now...");
});

// ✅ Create HTTP server & attach socket
const server = http.createServer(app);
setupSocket(server); // initializes Socket.IO

// ✅ Start server
const PORT = process.env.PORT || 4001;

// ✅ Start the cron job after server starts
server.listen(PORT, () => {
  console.log(`Server is live on port: ${PORT}`);
  startBookingStatusCron();
});
