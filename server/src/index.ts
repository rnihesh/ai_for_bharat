import 'dotenv/config';
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { issueRoutes } from "./routes/issues";
import { municipalityRoutes } from "./routes/municipalities";
import { uploadRoutes } from "./routes/upload";
import { classifyRoutes } from "./routes/classify";
import { adminRoutes } from "./routes/admin";
import { mlRoutes } from "./routes/ml";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/municipalities", municipalityRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/classify", classifyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ml", mlRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    name: "TechSprint GDG API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🔍 Health check at http://localhost:${PORT}/api/health`);
});

export default app;
