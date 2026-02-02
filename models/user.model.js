import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ["taskmaster", "quasher"],
            default: "quasher"

        },
        fullName: {
            type: String,
            required: true,
            index: true,
        },
        bio: {
            type: String
        },
        avatar: {
            type: String
        },
        address: {
            city: {
                type: String
            },
            state: {
                type: String
            },
            country: {
                type: String
            },

        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        password: {
            type: String,
            required: function () {
                return !this.appleId && !this.googleId;
            },
        },
        appleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        authProvider: {
            type: String,
            enum: ["email", "apple", "google"],
            default: "email"
        },
        phoneNumber: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        isPhoneVerified: {
            type: Boolean,
            default: false
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        twoFactorMethod: {
            type: String,
            enum: ["sms", "email", "none"],
            default: "none"
        },
        refreshToken: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
});


userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d",
        }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { _id: this._id },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
        }
    );
};


export const User = mongoose.model("User", userSchema);