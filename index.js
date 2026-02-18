import "dotenv/config";
import Express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./db/index.js";
import userRoutes from "./routes/user.routes.js";
import skillRoutes from "./routes/skill.routes.js";
import twoFactorRoutes from "./routes/twoFactor.routes.js";
import taskRoutes from "./routes/task.routes.js";
import taskCategoryRoutes from "./routes/taskCategory.routes.js";
import offerRoutes from "./routes/offer.routes.js";

const app = Express();

// Request-time env check (avoids process.exit in serverless; returns 503 if secrets missing)
app.use((req, res, next) => {
    if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
        console.error("Missing required env: ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set");
        return res.status(503).json({
            success: false,
            message: "Server misconfiguration: required environment variables are not set",
        });
    }
    next();
});

const corsOrigin = (process.env.CORS_ORIGIN || "*").trim();
app.use(
    cors({
        origin: corsOrigin === "*" ? true : corsOrigin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(Express.json({ limit: "16kb" }));
app.use(Express.urlencoded({ limit: "16kb", extended: true }));
app.use(cookieParser());

let isConnected = false;

async function ensureDbConnection() {
    if (isConnected) {
        return;
    }

    try {
        await connectDB();
        isConnected = true;
        console.log("✅ Database connected");
    } catch (err) {
        console.log("MONGO db connection failed !!! ", err);
        throw err;
    }
}

// Ensure DB is connected before handling requests (required for Vercel serverless)
app.use(async (req, res, next) => {
    try {
        await ensureDbConnection();
        next();
    } catch (err) {
        console.error("[DB] Connection failed:", err?.message || err);
        res.status(503).json({
            success: false,
            message: "Database unavailable. Please try again shortly.",
        });
    }
});

app.get("/", (req, res) => {
    res.send("Tas-Quash Backend is Successfully  Running.");
});

// Route declarations
app.use("/api/users", userRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/2fa", twoFactorRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/taskCategory", taskCategoryRoutes);
app.use("/api/offer", offerRoutes);

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error";
    console.error("[API Error]", statusCode, message);
    res.status(statusCode).json({
        success: false,
        message,
        ...(err.errors?.length && { errors: err.errors }),
    });
});

const PORT = process.env.PORT || 8000;

// Only start HTTP server when NOT on Vercel (local dev). On Vercel, the app is used as the serverless handler.
if (!process.env.VERCEL) {
    ensureDbConnection()
        .then(() => {
            app.listen(PORT, "0.0.0.0", () => {
                console.log(`⚙️ Server is running at http://0.0.0.0:${PORT}`);
            });
        })
        .catch((err) => {
            console.error("Failed to start server:", err.message);
            process.exit(1);
        });
}

export default app;
