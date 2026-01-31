import jwt from "jsonwebtoken";
import Otp from "../models/otp.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateOTP } from "../utils/common.js";
import { transporter, getDefaultFrom } from "../utils/mailer.js";
import { forgotPasswordOTPTemplate, welcomeEmailTemplate } from "../utils/mailTemplates.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import appleSignin from "apple-signin-auth";

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




const registerUser = asyncHandler(async (req, res) => {
    const { email, password, role, fullName } = req.body;

    if (!email || !password || !fullName) {
        throw new ApiError(400, "All fields are required");
    }

    if (!email.includes("@")) {
        throw new ApiError(400, "Invalid email");
    }

    const existedUser = await User.findOne({ email });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    const user = await User.create({
        email,
        password,
        role,
        fullName
    });

    let accessToken, refreshToken, loggedInUser;
    try {
        const tokens = await generateAccessTokenAndRefreshToken(user._id);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
        loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );
    } catch (err) {
        await User.findByIdAndDelete(user._id);
        if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
            throw new ApiError(
                500,
                "Server misconfiguration: ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in .env"
            );
        }
        throw err;
    }

    // Send welcome email asynchronously - don't block response on email failure
    try {
        transporter.sendMail({
            from: getDefaultFrom(),
            to: user.email,
            ...welcomeEmailTemplate(fullName),
        }).catch((err) => console.error("Welcome email failed:", err?.message || err));
    } catch (err) {
        console.error("Welcome email exception:", err?.message || err);
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    return res
        .status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                201,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User registered and logged in successfully"
            )
        );
});



const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password required");
    }

    const user = await User.findOne({ email });
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
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, "User not found");

    const otp = generateOTP();

    await Otp.create({
        userId: user._id,
        purpose: "forgotPassword",
        otp
    });

    // Send email asynchronously without blocking response
    transporter.sendMail({
        from: getDefaultFrom(),
        to: user.email,
        ...forgotPasswordOTPTemplate(otp),
    }).catch((err) => {
        console.error("Forgot-password email failed:", err?.message || err);
        if (process.env.NODE_ENV !== "production") {
            console.log("[DEV] Forgot-password OTP for", user.email, "->", otp);
        }
    });

    return res.json(
        new ApiResponse(200, {}, "An OTP has been sent to your email address.")
    );
});

const verifyOtp = asyncHandler(async (req, res) => {

    const { otp, email, purpose = "forgotPassword" } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, "User not found");

    const otpData = await Otp.findOne({
        userId: user._id,
        purpose,
        otp,
    });

    if (!otpData) {
        throw new ApiError(400, "Invalid OTP");
    }

    if (otpData.expiresAt < Date.now()) {
        await otpData.deleteOne();
        throw new ApiError(400, "OTP expired");
    }



    return res.json(
        new ApiResponse(200, { otp }, "OTP verified successfully")
    );

})

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

export { registerUser, verifyOtp, loginUser, logoutUser, refreshAccessToken, resetPassword, forgotPassword, getCurrentUser, appleLogin, googleLogin };


