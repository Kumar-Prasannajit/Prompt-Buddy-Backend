import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema(
    {
        avatar: {
            type: String, // Cloudinary URL
            required: true
        },
        username: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
            unique: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            trim: true
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        refreshToken: {
            type: String
        },
        forgotPasswordToken: {
            type: String
        },
        forgotPasswordExpiry: {
            type: Date
        },
        emailVerificationToken: {
            type: String
        },
        emailVerificationTokenExpiry: {
            type: Date
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        }
    },
    { timestamps: true }
);

// pre hook to encrypt password before saving in db
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
})

// custom method to compare password present in db with incoming password given by user while login
userSchema.methods.comparePassword = async function (incomingPassword) {
    return await bcrypt.compare(incomingPassword, this.password);
}

//custom method to generate access Token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

//custom method to generate refresh Token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateForgotPasswordToken = function () {
    const forgotToken = crypto.randomBytes(20).toString("hex");

    //hash the token and save it in db
    this.forgotPasswordToken = crypto
        .createHash("sha256")
        .update(forgotToken)
        .digest("hex");

    //set expiry time for token (e.g. 15 min)
    this.forgotPasswordExpiry = Date.now() + 15 * 60 * 1000;

    return forgotToken;
}

userSchema.methods.generateEmailVerificationToken = function () {
    const verificationToken = crypto.randomBytes(20).toString("hex");

    //hash the token and save it in db
    this.emailVerificationToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");

    //set expiry time for token (e.g. 15 min)
    this.emailVerificationTokenExpiry = Date.now() + 15 * 60 * 1000;

    return verificationToken;
}

export const User = mongoose.model("User", userSchema);