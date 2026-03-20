import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

const registerUser = asyncHandler(async (req, res) => {   
    //destructure user data from request url
    const { username, email, password, fullName } = req.body;

    //validate user data
    if (
        [username, email, password, fullName]
            .some(
                (field) => field?.trim() === ""
            )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Email validation using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email format");
    }

    // Username validation (alphanumeric, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-0_]{3,20}$/;
    if (!usernameRegex.test(username)) {
        throw new ApiError(400, "Username must be 3-20 characters long and contain only letters, numbers, or underscores");
    }

    // Password strength check (min 6 chars)
    if (password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    //validate if user already exists
    const alreadyUserExist = await User.findOne(
        {
            $or: [{ username }, { email }]
        }
    )

    if (alreadyUserExist) {
        throw new ApiError(400, "User with email or username already exists");
    }

    //handle avatar img file
    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    //for registartion it is compulsory to upload avatar img
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    //after getting local path of img upload to cloudinary to get avatr img URL
    const avatarUrl = await uploadToCloudinary(avatarLocalPath);

    if (!avatarUrl) {
        throw new ApiError(400, "Failed to upload img to cloudinary")
    }

    //after getting all data from request and processing them create user in database
    const newUser = await User.create(
        {
            username: username.toLowerCase(),
            email,
            password,
            fullName,
            avatar: avatarUrl
        }
    )

    //after creating user in db send the response without password and refreshToken
    const createdUser = await User.findById(newUser._id).select(
        "-password -refreshToken"
    )

    //check if user is created successfully
    if (!createdUser) {
        throw new ApiError(500, "Failed to register user")
    }

    // Generate email verification token
    const verificationToken = await createdUser.generateEmailVerificationToken();
    await createdUser.save({ validateBeforeSave: false });

    // Send verification email (mock)
    const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${verificationToken}`;
    const message = `Please verify your email by clicking on the link: \n\n ${verificationUrl}`;

    try {
        await sendEmail({
            email: createdUser.email,
            subject: "Email Verification",
            message
        });
    } catch (error) {
        // Log error but don't fail registration
        console.error("Email verification failed to send", error);
    }

    //send response
    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                createdUser,
                "User created successfully"
            )
        )
})

const generateAccessAndRefreshToken = async (userID) => {
    const user = await User.findById(userID);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    //save refresh Token in db
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
}

const loginUser = asyncHandler(async (req, res) => {
    //destructure user's input from request
    const {username, email, password} = req.body;

    //validate user email and username
    if(!username && !email) {
        throw new ApiError(400, "username or email is required");
    }

    //find user in db
    const user = await User.findOne(
        {
            $or: [{ username }, { email }]
        }
    )

    //validate user exist or not
    if(!user){
        throw new ApiError(400, "User does not exist! Register before login")
    }

    //validate password from db with password given by user while login
    //in db password is saved in hashed form so hash the current password given by user and then match with db password
    
    const isPasswordCorrect = await bcrypt.compare(password, user.password); 
    //compare function automatically hashes the incoming password and then match with db password

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid password");
    }

    //generate access token and refresh token by using the helper function generateAccessAndRefreshToken()
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    //remove password and refresh token field from user before sending response
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //configure option for cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    //send response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {user: loggedInUser, accessToken, refreshToken},
            "User logged in successfully"
        ))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    //destructure refresh token from user's cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    //validate if refresh token is present
    if(!incomingRefreshToken){
        throw new ApiError(400, "Refresh token is required");
    }

    //verify refresh token
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    //find user id from decoded token
    const user = await User.findById(decodedToken._id);

    //validate if user is present
    if(!user) {
        throw new ApiError(400, "invalid refresh token")
    }

    //compare refresh token from request with request token in db
    const isRefreshTokenValid = incomingRefreshToken === user.refreshToken;

    if(!isRefreshTokenValid){
        throw new ApiError(400, "invalid refresh token")
    }

    //generate new access token and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    //remove password and refresh token field from user before sending response
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //configure option for cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    //send response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {user: loggedInUser, accessToken, refreshToken},
            "Access token refreshed successfully"
        ))
})

const logoutUser = asyncHandler(async (req, res) => {    
    
    //destructure user from request from middleware
    const {user} = req;

    //validate if user is present
    if(!user) {
        throw new ApiError(400, "User not found");
    }

    //remove refresh token from db
    user.refreshToken = "";
    await user.save({ validateBeforeSave: false });

    //configure option for cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    //send response
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(
            200,
            {},
            "User logged out successfully"
        ))
})

/**
 * @description Change current password
 * @route PATCH /api/v1/users/change-password
 * @access Private
 */
const changeCurrentPassword = asyncHandler(async (req, res) => {

    const { oldPassword, newPassword } = req.body || {};

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old and new passwords are required");
    }

    //validate if new password is same as old password
    if(oldPassword === newPassword){
        throw new ApiError(400, "New password cannot be same as old password");
    }

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.comparePassword(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, "New password must be at least 6 characters long");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

/**
 * @description Get current user
 * @route GET /api/v1/users/current-user
 * @access Private
 */
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully"
        ));
});

/**
 * @description Update account details
 * @route PATCH /api/v1/users/update-account
 * @access Private
 */
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "FullName and Email are required");
    }

    // Email validation using regex (same logic as registration)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email format");
    }

    //validate if new email is same as old email
    if(email === req.user?.email){
        throw new ApiError(400, "New email cannot be same as old email");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    user.fullName = fullName;
    user.email = email;
    user.isEmailVerified = false;

    // Generate new email verification token
    const verificationToken = await user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email (mock)
    const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${verificationToken}`;
    const message = `Please re-verify your email by clicking on the link: \n\n ${verificationUrl}`;

    try {
        await sendEmail({
            email: user.email,
            subject: "Email Re-verification",
            message
        });
    } catch (error) {
        console.error("Email verification failed to send", error);
    }

    const updatedUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Account details updated and verification email sent"));
});

/**
 * @description Update user avatar
 * @route PATCH /api/v1/users/avatar
 * @access Private
 */
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    // Upload to Cloudinary
    const avatarUrl = await uploadToCloudinary(avatarLocalPath);

    if (!avatarUrl) {
        throw new ApiError(400, "Failed to upload avatar to Cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatarUrl
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

/**
 * @description Forgot password
 * @route POST /api/v1/users/forgot-password
 * @access Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found with this email");
    }

    const forgotToken = user.generateForgotPasswordToken();
    await user.save({ validateBeforeSave: false });

    // In production, use the actual domain
    const resetUrl = `${req.protocol}://${req.get("host")}/api/v1/users/reset-password/${forgotToken}`;

    const message = `Your password reset token is: \n\n ${resetUrl} \n\n If you did not request this email, please ignore it.`;

    try {
        await sendEmail({
            email: user.email,
            subject: "Password Reset Request",
            message
        });

        return res
            .status(200)
            .json(new ApiResponse(200, {}, "Password reset email sent successfully"));
    } catch (error) {
        console.error("Email send error:", error);
        user.forgotPasswordToken = undefined;
        user.forgotPasswordExpiry = undefined;
        await user.save({ validateBeforeSave: false });

        throw new ApiError(500, "Failed to send password reset email");
    }
});

/**
 * @description Reset password
 * @route POST /api/v1/users/reset-password/:token
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        throw new ApiError(400, "New password is required");
    }

    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired password reset token");
    }

    //validate if new password is same as old password
    if(password === user.password){
        throw new ApiError(400, "New password cannot be same as old password");
    }

    //validate if new password is at least 6 characters long
    if(password.length < 6){
        throw new ApiError(400, "New password must be at least 6 characters long");
    }

    user.password = password;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password reset successful"));
});

/**
 * @description Verify email
 * @route GET /api/v1/users/verify-email/:token
 * @access Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;

    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired email verification token");
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;

    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Email verified successfully"));
});

export { 
    registerUser, 
    loginUser, 
    refreshAccessToken, 
    logoutUser, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    forgotPassword, 
    resetPassword, 
    verifyEmail 
}
