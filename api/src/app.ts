import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import cookieParser from 'cookie-parser';
import { authMiddleware } from './auth/session.js';
import { errorHandler } from "./middleware/error.js";
import v1Router from "./routes/index.js";
import muxWebhook from "./routes/v1/webhooks/mux.js"; // 👈 import the handler array

export function buildApp() {
  const app = express();

  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.set('trust proxy', 1);

  app.get("/api/debug/env", (_req, res) =>
    res.json({ MUX_WEBHOOK_DEV_BYPASS: config.MUX_WEBHOOK_DEV_BYPASS })
  );

  // Health
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // ✅ Mount webhook with express.raw BEFORE any json parser
  app.post("/api/v1/webhooks/mux", muxWebhook as any);

  // Normal JSON for the rest
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware as any);

  // Versioned API (all other routes)
  app.use("/api", v1Router);

  // Errors last
  app.use(errorHandler);

  return app;
}
