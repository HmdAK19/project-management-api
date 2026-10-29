import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: {
    status: "ok", timestamp: new Date().toISOString(), version: "1.0.0",
  } });
});
app.use(router);
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
app.use(errorHandler);

export default app;
