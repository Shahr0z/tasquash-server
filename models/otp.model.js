import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    purpose: {
        type: String,
        required: true,
        enum: ["register", "login", "forgotPassword"],
    },
    otp: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 10 * 60 * 1000),
        expires: 600,
    },
});

const Otp = mongoose.model("Otp", otpSchema);
export default Otp;
