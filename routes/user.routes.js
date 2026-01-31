import { Router } from "express";
import { forgotPassword, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, resetPassword, verifyOtp, appleLogin, googleLogin } from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/user.middleware.js";


const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", verifyJWT, logoutUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/apple-login", appleLogin);
router.post("/google-login", googleLogin);
router.get("/me", verifyJWT, getCurrentUser);



export default router;