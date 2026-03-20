import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";

const connectDB = asyncHandler(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}`)
        console.log("MongoDB connected successfully")
    } catch (error) {
        console.log("MongoDB connection failed", error)
    }
})

export default connectDB;