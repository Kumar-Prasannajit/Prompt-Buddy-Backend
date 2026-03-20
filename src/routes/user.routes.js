import { Router } from "express";
import { registerUser, loginUser, refreshAccessToken, logoutUser, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, forgotPassword, resetPassword, verifyEmail } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT, authorizeRole } from "../middlewares/auth.middlewares.js";

const router = Router();


/**
 * @description Register a new user
 * @route POST /api/v1/users/register
 * @access Public
 */
router.route("/register").post(

    //multer middleware to handle file upload

    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }
    ]),

    //register user controller

    registerUser
);

/**
 * @description Login user and get tokens
 * @route POST /api/v1/users/login
 * @access Public
 */
router.route("/login").post(
    //login user controller
    loginUser
);

/**
 * @description Refresh access token using refresh token
 * @route POST /api/v1/users/refresh-token
 * @access Public
 */
router.route("/refresh-token").post(refreshAccessToken);

/**
 * @description Logout user
 * @route POST /api/v1/users/logout
 * @access Private
 */
router.route("/logout").post(verifyJWT, logoutUser);

/**
 * @description Change current password
 * @route PATCH /api/v1/users/change-password
 * @access Private
 */
router.route("/change-password").patch(verifyJWT, upload.none(), changeCurrentPassword);

/**
 * @description Get current user
 * @route GET /api/v1/users/current-user
 * @access Private
 */
router.route("/current-user").get(verifyJWT, getCurrentUser);

/**
 * @description Update account details
 * @route PATCH /api/v1/users/update-account
 * @access Private
 */
router.route("/update-account").patch(verifyJWT, upload.none(), updateAccountDetails);

/**
 * @description Update user avatar
 * @route PATCH /api/v1/users/avatar
 * @access Private
 */
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

/**
 * @description Forgot password
 * @route POST /api/v1/users/forgot-password
 * @access Public
 */
router.route("/forgot-password").post(forgotPassword);

/**
 * @description Reset password
 * @route POST /api/v1/users/reset-password/:token
 * @access Public
 */
router.route("/reset-password/:token").post(resetPassword);

/**
 * @description Verify email
 * @route GET /api/v1/users/verify-email/:token
 * @access Public
 */
router.route("/verify-email/:token").get(verifyEmail);

/**
 * @description Admin Only Route
 * @route GET /api/v1/users/admin-only
 * @access Private (Admin Only)
 */
router.route("/admin-only").get(verifyJWT, authorizeRole(["admin"]), (req, res) => {
    return res.status(200).json({ message: "Welcome Admin!" });
});

export default router;