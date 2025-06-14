import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const generateEnrollmentNumber = async function () {
  const count = await this.constructor.countDocuments();
  const year = new Date().getFullYear();
  return `PUBLIB${year}${(count + 1).toString().padStart(5, "0")}`;
};

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    enrollmentNumber: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    mobile: {
      type: String,
      required: true,
      match: /^[6-9]\d{9}$/,
    },
    password: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    address: {
      type: String,
      required: true,
    },
    idProofType: {
      type: String,
      enum: ["Aadhar", "PAN", "VoterID", "DrivingLicense", "Passport", "Other"],
    },
    idProofNumber: {
      type: String,
    },
    membershipType: {
      type: String,
      enum: ["Basic", "Premium", "Visitor"],
      default: "Basic",
    },
    qrCodeImage: {
      type: String, // Path or URL to QR code image
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profilePhoto: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

studentSchema.pre("save", async function (next) {
  if (!this.enrollmentNumber) {
    this.enrollmentNumber = await generateEnrollmentNumber.call(this);
  }
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

export default mongoose.model("Student", studentSchema);
