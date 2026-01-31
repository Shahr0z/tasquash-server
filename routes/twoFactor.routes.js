import { Router } from "express";
import {
    sendPhoneOTP,
    verifyPhoneOTP,
    enable2FA,
    disable2FA,
    send2FAOTP,
    verify2FAOTP,
    get2FAStatus
} from "../controllers/twoFactor.controller.js";
import { verifyJWT } from "../middleware/user.middleware.js";

const router = Router();

// Public routes (for login flow)
router.post("/send-login-otp", send2FAOTP);
router.post("/verify-login-otp", verify2FAOTP);

// Protected routes (require authentication)
router.post("/send-phone-otp", verifyJWT, sendPhoneOTP);
router.post("/verify-phone-otp", verifyJWT, verifyPhoneOTP);
router.post("/enable", verifyJWT, enable2FA);
router.post("/disable", verifyJWT, disable2FA);
router.get("/status", verifyJWT, get2FAStatus);

export default router;
