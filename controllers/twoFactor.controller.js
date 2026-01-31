import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { sendOTP, verifyOTP } from "../utils/twilio.js";


const sendPhoneOTP = asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;
    const userId = req.user?._id;

    if (!phoneNumber) {
        throw new ApiError(400, "Phone number is required");
    }


    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
        throw new ApiError(400, "Invalid phone number format. Use international format (e.g., +1234567890)");
    }


    if (userId) {
        const existingUser = await User.findOne({
            phoneNumber,
            _id: { $ne: userId },
            isPhoneVerified: true
        });

        if (existingUser) {
            throw new ApiError(409, "Phone number is already registered to another account");
        }
    }


    try {
        await sendOTP(phoneNumber, "sms");
    } catch (err) {
        const message = err?.message || "Failed to send OTP";
        console.error("sendPhoneOTP Twilio error:", message);
        throw new ApiError(503, `SMS could not be sent: ${message}`);
    }

    return res.status(200).json(
        new ApiResponse(200, {
            phoneNumber,
            status: "success"
        }, "A verification code has been sent to your phone.")
    );
});


const verifyPhoneOTP = asyncHandler(async (req, res) => {
    const { phoneNumber, code } = req.body;
    const userId = req.user._id;

    if (!phoneNumber || !code) {
        throw new ApiError(400, "Phone number and OTP code are required");
    }

    let result;
    try {
        result = await verifyOTP(phoneNumber, String(code).trim());
    } catch (err) {
        const message = err?.message || "Verification failed";
        console.error("verifyPhoneOTP Twilio error:", message);
        throw new ApiError(400, message);
    }
    if (!result.success) {
        throw new ApiError(400, "Invalid or expired OTP");
    }

    // Update user's phone number and verification status
    const user = await User.findByIdAndUpdate(
        userId,
        {
            phoneNumber,
            isPhoneVerified: true,
            twoFactorEnabled: true,
            twoFactorMethod: "sms"
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, { user }, "Phone number verified successfully")
    );
});


const enable2FA = asyncHandler(async (req, res) => {
    const { method = "sms" } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (method === "sms" && !user.isPhoneVerified) {
        throw new ApiError(400, "Please verify your phone number first before enabling SMS 2FA");
    }

    user.twoFactorEnabled = true;
    user.twoFactorMethod = method;
    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(userId).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "Two-factor authentication enabled successfully")
    );
});


const disable2FA = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
        userId,
        {
            twoFactorEnabled: false,
            twoFactorMethod: "none"
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, { user }, "Two-factor authentication disabled successfully")
    );
});


const send2FAOTP = asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        throw new ApiError(400, "Phone number is required");
    }

    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.twoFactorEnabled) {
        throw new ApiError(400, "2FA is not enabled for this account");
    }

    if (user.twoFactorMethod === "sms") {
        if (!user.phoneNumber || !user.isPhoneVerified) {
            throw new ApiError(400, "Phone number not verified for 2FA");
        }

        try {
            await sendOTP(user.phoneNumber, "sms");
        } catch (err) {
            const message = err?.message || "Failed to send OTP";
            console.error("send2FAOTP Twilio error:", message);
            throw new ApiError(503, `SMS could not be sent: ${message}`);
        }

        return res.status(200).json(
            new ApiResponse(200, {
                method: "sms",
                phoneHint: user.phoneNumber.slice(-4).padStart(user.phoneNumber.length, '*'),
                status: "success"
            }, "A verification code has been sent to your phone.")
        );
    }

    throw new ApiError(400, "Invalid 2FA method configured");
});


const verify2FAOTP = asyncHandler(async (req, res) => {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
        throw new ApiError(400, "Phone number and OTP code are required");
    }

    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.twoFactorEnabled) {
        throw new ApiError(400, "2FA is not enabled for this account");
    }

    if (user.twoFactorMethod === "sms") {
        let result;
        try {
            result = await verifyOTP(user.phoneNumber, String(code).trim());
        } catch (err) {
            const message = err?.message || "Verification failed";
            console.error("verify2FAOTP Twilio error:", message);
            throw new ApiError(400, message);
        }
        if (!result.success) {
            throw new ApiError(400, "Invalid or expired OTP");
        }
    }

    // Generate tokens after successful 2FA verification
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                accessToken,
                refreshToken
            }, "2FA verification successful")
        );
});


const get2FAStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findById(userId).select("twoFactorEnabled twoFactorMethod phoneNumber isPhoneVerified");

    return res.status(200).json(
        new ApiResponse(200, {
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorMethod: user.twoFactorMethod,
            phoneNumber: user.phoneNumber ? user.phoneNumber.slice(-4).padStart(user.phoneNumber.length, '*') : null,
            isPhoneVerified: user.isPhoneVerified
        }, "2FA status retrieved")
    );
});

export {
    sendPhoneOTP,
    verifyPhoneOTP,
    enable2FA,
    disable2FA,
    send2FAOTP,
    verify2FAOTP,
    get2FAStatus
};
