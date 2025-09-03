import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
        },
        otp: {
            type: String,
            required: true,
        },
        newPassword: {
            type: String,
            trim: true
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// OTP expire hone ke baad auto delete (TTL index)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model("Otp", otpSchema);
