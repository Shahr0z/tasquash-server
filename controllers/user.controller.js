import jwt from "jsonwebtoken";
import Otp from "../models/otp.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateOTP, parseEmailOrPhone } from "../utils/common.js";
import { transporter, getDefaultFrom } from "../utils/mailer.js";
import { authOTPTemplate, forgotPasswordOTPTemplate, welcomeEmailTemplate } from "../utils/mailTemplates.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import appleSignin from "apple-signin-auth";
import { sendOTP, verifyOTP } from "../utils/twilio.js";

const generateAccessTokenAndRefreshToken = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};


const googleLogin = asyncHandler(async (req, res) => {

    const { email, fullName, googleId } = req.body;

    let user = await User.findOne({ email });

    if (!user) {

        user = await User.create({
            email: email,
            fullName: fullName,
            googleId,
            authProvider: "google",
        });
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

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
                refreshToken,
                isNewUser: !user.createdAt || Date.now() - user.createdAt < 60000
            }, "Google login successful")
        );

})




const PLACEHOLDER_EMAIL_PREFIX = "phone_";
const PLACEHOLDER_EMAIL_SUFFIX = "@users.tasquash.app";

/** Format phone for Twilio E.164 (e.g. 1234567890 -> +1234567890). */
function toE164(phone) {
    const digits = String(phone).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
}

const registerUser = asyncHandler(async (req, res) => {
    const { emailOrPhone, email: legacyEmail, password, role, fullName } = req.body;
    const identifier = emailOrPhone ?? legacyEmail;

    if (!identifier || !password || !fullName) {
        throw new ApiError(400, "All fields are required");
    }

    const parsed = parseEmailOrPhone(identifier);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    let email, phoneNumber;
    if (parsed.type === "email") {
        email = parsed.email;
        const existedUser = await User.findOne({ email });
        if (existedUser) throw new ApiError(409, "User already exists with this email");
    } else {
        phoneNumber = parsed.phone;
        const existedUser = await User.findOne({ phoneNumber });
        if (existedUser) throw new ApiError(409, "User already exists with this phone number");
        email = `${PLACEHOLDER_EMAIL_PREFIX}${phoneNumber}${PLACEHOLDER_EMAIL_SUFFIX}`;
    }

    const user = await User.create({
        email,
        ...(phoneNumber && { phoneNumber }),
        password,
        role,
        fullName,
        ...(parsed.type === "email" && { isEmailVerified: false }),
        ...(parsed.type === "phone" && { isPhoneVerified: false }),
    });

    const otp = generateOTP();

    if (parsed.type === "email") {
        await Otp.create({ userId: user._id, purpose: "register", otp });
        try {
            await transporter.sendMail({
                from: getDefaultFrom(),
                to: user.email,
                ...authOTPTemplate(otp, "register"),
            });
        } catch (err) {
            await User.findByIdAndDelete(user._id);
            await Otp.deleteOne({ userId: user._id, purpose: "register" });
            console.error("[Email] Register OTP failed:", err?.message || err, "code:", err?.code, "response:", err?.response?.slice?.(0, 100));
            throw new ApiError(
                503,
                "We could not send the verification code to your email. Please try again."
            );
        }
        return res.status(201).json(
            new ApiResponse(201, {
                requiresVerification: true,
                type: "email",
                emailOrPhone: user.email,
            }, "Verification code sent to your email.")
        );
    }

    try {
        await sendOTP(toE164(phoneNumber), "sms");
    } catch (err) {
        await User.findByIdAndDelete(user._id);
        console.error("[SMS] Register OTP failed:", err?.message || err);
        throw new ApiError(
            503,
            err?.message || "We could not send the verification code to your phone. Please try again."
        );
    }
    return res.status(201).json(
        new ApiResponse(201, {
            requiresVerification: true,
            type: "phone",
            emailOrPhone: phoneNumber,
            phoneHint: phoneNumber.slice(-4),
        }, "Verification code sent to your phone.")
    );
});

const verifySignup = asyncHandler(async (req, res) => {
    const { emailOrPhone, otp } = req.body;

    if (!emailOrPhone || !otp) {
        throw new ApiError(400, "Email/phone and OTP are required");
    }

    const parsed = parseEmailOrPhone(emailOrPhone);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    const user = parsed.type === "email"
        ? await User.findOne({ email: parsed.email })
        : await User.findOne({ phoneNumber: parsed.phone });
    if (!user) throw new ApiError(404, "User not found");

    if (parsed.type === "email") {
        const otpData = await Otp.findOne({ userId: user._id, purpose: "register", otp: String(otp).trim() });
        if (!otpData) throw new ApiError(400, "Invalid or expired OTP");
        if (otpData.expiresAt < Date.now()) {
            await otpData.deleteOne();
            throw new ApiError(400, "OTP expired");
        }
        await Otp.deleteOne({ userId: user._id, purpose: "register" });
        user.isEmailVerified = true;
        await user.save({ validateBeforeSave: false });
    } else {
        const result = await verifyOTP(toE164(parsed.phone), String(otp).trim());
        if (!result.success) throw new ApiError(400, "Invalid or expired OTP");
        user.isPhoneVerified = true;
        await user.save({ validateBeforeSave: false });
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    if (!user.email.startsWith(PLACEHOLDER_EMAIL_PREFIX)) {
        try {
            await transporter.sendMail({
                from: getDefaultFrom(),
                to: user.email,
                ...welcomeEmailTemplate(user.fullName),
            });
        } catch (err) {
            console.error("[Email] Welcome email failed:", err?.message || err);
        }
    }

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
                refreshToken,
            }, "Account verified and signed in successfully")
        );
});

const resendSignupOTP = asyncHandler(async (req, res) => {
    const { emailOrPhone } = req.body;

    if (!emailOrPhone) {
        throw new ApiError(400, "Email or phone number is required");
    }

    const parsed = parseEmailOrPhone(emailOrPhone);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    const user = parsed.type === "email"
        ? await User.findOne({ email: parsed.email })
        : await User.findOne({ phoneNumber: parsed.phone });
    if (!user) throw new ApiError(404, "User not found");

    if (parsed.type === "email") {
        await Otp.deleteMany({ userId: user._id, purpose: "register" });
        const otp = generateOTP();
        await Otp.create({ userId: user._id, purpose: "register", otp });
        try {
            await transporter.sendMail({
                from: getDefaultFrom(),
                to: user.email,
                ...authOTPTemplate(otp, "register"),
            });
        } catch (err) {
            console.error("[Email] Resend signup OTP failed:", err?.message || err, "code:", err?.code);
            throw new ApiError(503, "We could not send the code to your email. Please try again.");
        }
        return res.json(
            new ApiResponse(200, {}, "Verification code sent to your email.")
        );
    }

    try {
        await sendOTP(toE164(parsed.phone), "sms");
    } catch (err) {
        console.error("[SMS] Resend signup OTP failed:", err?.message || err);
        throw new ApiError(503, err?.message || "We could not send the code to your phone. Please try again.");
    }
    return res.json(
        new ApiResponse(200, {}, "Verification code sent to your phone.")
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const { emailOrPhone, email: legacyEmail, password } = req.body;
    const identifier = emailOrPhone ?? legacyEmail;

    if (!identifier || !password) {
        throw new ApiError(400, "Email/phone and password required");
    }

    const parsed = parseEmailOrPhone(identifier);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    const user = parsed.type === "email"
        ? await User.findOne({ email: parsed.email })
        : await User.findOne({ phoneNumber: parsed.phone });
    if (!user) throw new ApiError(404, "Invalid credentials");

    const isValidPassword = await user.isPasswordCorrect(password);
    if (!isValidPassword) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
        return res.status(200).json(
            new ApiResponse(200, {
                requires2FA: true,
                email: user.email,
                twoFactorMethod: user.twoFactorMethod,
                phoneHint: user.phoneNumber
            }, "2FA verification required")
        );
    }

    const { accessToken, refreshToken } =
        await generateAccessTokenAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

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
                requires2FA: false,
                user: loggedInUser,
                accessToken,
                refreshToken
            }, "Login successful")
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshToken: 1 },
    });

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized");
    }

    const decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decoded._id);
    if (!user || incomingRefreshToken !== user.refreshToken) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken, refreshToken } =
        await generateAccessTokenAndRefreshToken(user._id);

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
            new ApiResponse(200, { accessToken, refreshToken }, "Token refreshed")
        );
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { emailOrPhone, email: legacyEmail } = req.body;
    const identifier = emailOrPhone ?? legacyEmail;

    if (!identifier) {
        throw new ApiError(400, "Email or phone number is required");
    }

    const parsed = parseEmailOrPhone(identifier);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    const user = parsed.type === "email"
        ? await User.findOne({ email: parsed.email })
        : await User.findOne({ phoneNumber: parsed.phone });
    if (!user) throw new ApiError(404, "User not found");

    const isPhoneOnly = user.email.startsWith(PLACEHOLDER_EMAIL_PREFIX);

    if (isPhoneOnly) {
        try {
            await sendOTP(toE164(user.phoneNumber), "sms");
        } catch (err) {
            console.error("[SMS] Forgot-password OTP failed:", err?.message || err);
            throw new ApiError(
                503,
                err?.message || "We could not send the code to your phone. Please try again."
            );
        }
        return res.json(
            new ApiResponse(200, {
                email: user.email,
                channel: "phone",
                phoneHint: user.phoneNumber ? user.phoneNumber.slice(-4) : null,
            }, "A verification code has been sent to your phone.")
        );
    }

    const otp = generateOTP();
    await Otp.create({ userId: user._id, purpose: "forgotPassword", otp });

    try {
        await transporter.sendMail({
            from: getDefaultFrom(),
            to: user.email,
            ...forgotPasswordOTPTemplate(otp),
        });
    } catch (err) {
        console.error("[Email] Forgot-password send failed:", err?.message || err, "code:", err?.code);
        throw new ApiError(
            503,
            "We could not send the OTP email. Please check your email address and try again, or contact support."
        );
    }

    return res.json(
        new ApiResponse(200, { email: user.email, channel: "email" }, "An OTP has been sent to your email address.")
    );
});

const verifyOtp = asyncHandler(async (req, res) => {
    const { otp, email, purpose = "forgotPassword" } = req.body;

    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required");
    }

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, "User not found");

    const isPhoneOnly = user.email.startsWith(PLACEHOLDER_EMAIL_PREFIX);

    if (isPhoneOnly && purpose === "forgotPassword") {
        const result = await verifyOTP(toE164(user.phoneNumber), String(otp).trim());
        if (!result.success) throw new ApiError(400, "Invalid or expired OTP");
        return res.json(
            new ApiResponse(200, { otp, email: user.email }, "OTP verified successfully")
        );
    }

    const otpData = await Otp.findOne({
        userId: user._id,
        purpose,
        otp: String(otp).trim(),
    });

    if (!otpData) {
        throw new ApiError(400, "Invalid OTP");
    }

    if (otpData.expiresAt < Date.now()) {
        await otpData.deleteOne();
        throw new ApiError(400, "OTP expired");
    }

    return res.json(
        new ApiResponse(200, { otp, email: user.email }, "OTP verified successfully")
    );
});

const sendLoginOTP = asyncHandler(async (req, res) => {
    const { emailOrPhone } = req.body;

    if (!emailOrPhone) {
        throw new ApiError(400, "Email or phone number is required");
    }

    const parsed = parseEmailOrPhone(emailOrPhone);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    const user = parsed.type === "email"
        ? await User.findOne({ email: parsed.email })
        : await User.findOne({ phoneNumber: parsed.phone });
    if (!user) throw new ApiError(404, "User not found");

    if (parsed.type === "email") {
        const otp = generateOTP();
        await Otp.create({ userId: user._id, purpose: "login", otp });
        try {
            await transporter.sendMail({
                from: getDefaultFrom(),
                to: user.email,
                ...authOTPTemplate(otp, "login"),
            });
        } catch (err) {
            await Otp.deleteOne({ userId: user._id, purpose: "login" });
            console.error("[Email] Login OTP failed:", err?.message || err, "code:", err?.code);
            throw new ApiError(
                503,
                "We could not send the code to your email. Please try again."
            );
        }
        return res.json(
            new ApiResponse(200, {
                requiresOTP: true,
                email: user.email,
                channel: "email",
            }, "Verification code sent to your email.")
        );
    }

    try {
        await sendOTP(toE164(parsed.phone), "sms");
    } catch (err) {
        console.error("[SMS] Login OTP failed:", err?.message || err);
        throw new ApiError(
            503,
            err?.message || "We could not send the code to your phone. Please try again."
        );
    }
    return res.json(
        new ApiResponse(200, {
            requiresOTP: true,
            email: user.email,
            channel: "phone",
            phoneHint: parsed.phone ? parsed.phone.slice(-4) : null,
        }, "Verification code sent to your phone.")
    );
});

const verifyLoginOTP = asyncHandler(async (req, res) => {
    const { emailOrPhone, otp } = req.body;

    if (!emailOrPhone || !otp) {
        throw new ApiError(400, "Email/phone and OTP are required");
    }

    const parsed = parseEmailOrPhone(emailOrPhone);
    if (!parsed.type) {
        throw new ApiError(400, "Please enter a valid email or phone number");
    }

    const user = parsed.type === "email"
        ? await User.findOne({ email: parsed.email })
        : await User.findOne({ phoneNumber: parsed.phone });
    if (!user) throw new ApiError(404, "User not found");

    if (parsed.type === "email") {
        const otpData = await Otp.findOne({ userId: user._id, purpose: "login", otp: String(otp).trim() });
        if (!otpData) throw new ApiError(400, "Invalid or expired OTP");
        if (otpData.expiresAt < Date.now()) {
            await otpData.deleteOne();
            throw new ApiError(400, "OTP expired");
        }
        await Otp.deleteOne({ userId: user._id, purpose: "login" });
    } else {
        const result = await verifyOTP(toE164(parsed.phone), String(otp).trim());
        if (!result.success) throw new ApiError(400, "Invalid or expired OTP");
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);
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
                refreshToken,
            }, "Login successful")
        );
});

const resetPassword = asyncHandler(async (req, res) => {
    const { newPassword, email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User not found");
    }



    user.password = newPassword;
    user.refreshToken = undefined;
    await user.save();

    await Otp.findOneAndDelete({
        userId: user._id,
        purpose: "forgotPassword",
    });

    return res.json(
        new ApiResponse(200, {}, "Password reset successful")
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select(
        "-password -refreshToken"
    );

    return res.json(
        new ApiResponse(200, user, "User fetched")
    );
});


const appleLogin = asyncHandler(async (req, res) => {
    const { identityToken, user: appleUser, fullName } = req.body;

    if (!identityToken) {
        throw new ApiError(400, "Identity token is required");
    }


    const applePayload = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: false,
    });

    const { sub: appleId, email } = applePayload;

    if (!appleId) {
        throw new ApiError(400, "Invalid Apple token");
    }


    let user = await User.findOne({ appleId });

    if (!user && email) {
        // Check if user exists with this email
        user = await User.findOne({ email });

        if (user) {
            // Link Apple ID to existing account
            user.appleId = appleId;
            user.authProvider = "apple";
            await user.save({ validateBeforeSave: false });
        }
    }

    if (!user) {
        // Create new user
        const userName = fullName?.givenName && fullName?.familyName
            ? `${fullName.givenName} ${fullName.familyName}`
            : email?.split("@")[0] || `User_${appleId.substring(0, 8)}`;

        user = await User.create({
            email: email || `${appleId}@privaterelay.appleid.com`,
            fullName: userName,
            appleId,
            authProvider: "apple",
        });
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

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
                refreshToken,
                isNewUser: !user.createdAt || Date.now() - user.createdAt < 60000
            }, "Apple login successful")
        );


});

export { registerUser, verifySignup, resendSignupOTP, verifyOtp, loginUser, logoutUser, refreshAccessToken, resetPassword, forgotPassword, getCurrentUser, appleLogin, googleLogin, sendLoginOTP, verifyLoginOTP };


