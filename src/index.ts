/**
 * ────────────────────────────────────────────────────────
 *  Project Management Platform – API Server
 *  Stack: Express + TypeScript + Prisma ORM + SQLite
 * ────────────────────────────────────────────────────────
 */

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config/index.js";
import router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  const app = express();

  // ─────────── Global Middleware ───────────
  app.use(
    cors({
      origin: config.clientOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─────────── Health Check ───────────
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  });

  // ─────────── API Routes ───────────
  app.use(router);

  // ─────────── Serve frontend static files (production) ───────────
  if (config.nodeEnv === "production") {
    const frontendDist = path.resolve(__dirname, "../../dist");
    app.use(express.static(frontendDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  // ─────────── Error Handler (must be last) ───────────
  app.use(errorHandler);

  // ─────────── Start ───────────
  app.listen(config.port, () => {
    console.log("");
    console.log(`  ╔══════════════════════════════════════════════════╗`);
    console.log(`  ║   Project Management API                     ║`);
    console.log(
      `  ║   Running on : http://localhost:${config.port}          ║`,
    );
    console.log(`  ║   Environment: ${config.nodeEnv.padEnd(30)}║`);
    console.log(`  ╚══════════════════════════════════════════════════╝`);
    console.log("");
    console.log(`  API Health : http://localhost:${config.port}/api/health`);
    console.log(`  Init Data  : http://localhost:${config.port}/api/init`);
    console.log("");
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
