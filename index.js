import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import ConnectDB from "./config/Db.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import inquiryRoutes from "./routes/inquiryRoutes.js";
import UserRoutes from "./routes/UserRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

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
app.use("/api/libraries", libraryRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/users", UserRoutes);

// Start Server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server is live on port: ${PORT}`);
});
