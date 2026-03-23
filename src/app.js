import express from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { ApiError } from "./utils/ApiError.js";

const app = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: "Too many requests from this IP, please try again after 15 minutes"
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

//common middlewares
app.use(express.json({
    limit: "1mb"
}));
app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));
app.use(cookieParser());

//import Routes
import healthCheckRouter from "./routes/healthCheck.routes.js"
import userRouter from "./routes/user.routes.js"
import promptRoutes from "./routes/prompt.routes.js"

//Use Routes
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/prompts", promptRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors,
            data: null
        });
    }

    // Default error
    console.error("Unhandle Error:", err);
    return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: [],
        data: null
    });
});

export default app;