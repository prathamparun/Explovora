import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);

app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Explovora API is running",
  });
});

// Centralized error handler
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled request error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  },
);

export default app;