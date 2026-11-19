import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";

import { version1Router } from "./routes/version1/index.js";

function resolveCorsOrigin(): string | string[] | boolean {
  const rawOrigin = process.env.WEB_ORIGIN?.trim();
  if (!rawOrigin) {
    return process.env.NODE_ENV === "production" ? false : true;
  }
  const origins = rawOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0]! : origins;
}

export function createApp(): Express {
  const app = express();

  // Trust first proxy hop for accurate client IPs
  app.set("trust proxy", 1);

  // Core security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: resolveCorsOrigin(),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: process.env.MAX_BODY_SIZE ?? "1mb" }));

  // API routes
  app.use("/api/version1", version1Router);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  return app;
}

export const app = createApp();