import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";

const verifyJWT = asyncHandler(async(req, res, next) => {
    try {
        //get accesss token from users cookies
        const  accessToken = req.cookies?.accessToken || req.headers.authorization?.replace("Bearer ", "");

        //check if access token is present
        if(!accessToken){
            throw new ApiError(400, "Access token is required");
        }

        //verify access token
        const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

        //find user id from decoded token except password and refresh token save memory
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        //validate if user is present
        if(!user) {
            throw new ApiError(400, "invalid access token")
        }

        //attach user to request
        req.user = user;

        //call next middleware
        next();
        
    } catch (error) {
        throw new ApiError(400, error?.message || "Invalid access token")
    }
})

export { verifyJWT };

const authorizeRole = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        if (!roles.includes(req.user.role)) {
            throw new ApiError(403, `User role ${req.user.role} is not authorized to access this resource`);
        }

        next();
    };
};

export { authorizeRole };