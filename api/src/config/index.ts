// Load .env first (so all process.env are populated)
import "dotenv/config";

// ✅ ESM-friendly fs import
import { readFileSync } from "node:fs";

function must(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const config = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3200),
  HOST: process.env.HOST ?? "127.0.0.1",

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),

  // Mux server API
  MUX_TOKEN_ID: must("MUX_TOKEN_ID", process.env.MUX_TOKEN_ID),
  MUX_TOKEN_SECRET: must("MUX_TOKEN_SECRET", process.env.MUX_TOKEN_SECRET),

  // Playback signing (either env PEM or file)
  MUX_SIGNING_KEY_ID: must("MUX_SIGNING_KEY_ID", process.env.MUX_SIGNING_KEY_ID),
  MUX_SIGNING_KEY_PEM: (() => {
    const file = process.env.MUX_SIGNING_KEY_FILE;
    const envPem = process.env.MUX_SIGNING_KEY_PRIVATE_KEY;
    if (envPem) return envPem.replace(/\\n/g, "\n");
    if (!file) throw new Error("MUX_SIGNING_KEY_FILE or MUX_SIGNING_KEY_PRIVATE_KEY required");
    return readFileSync(file, "utf8"); // ✅ ESM-safe
  })(),

  // Webhooks
  MUX_WEBHOOK_SECRET: must("MUX_WEBHOOK_SECRET", process.env.MUX_WEBHOOK_SECRET),
  MUX_WEBHOOK_DEV_BYPASS: process.env.MUX_WEBHOOK_DEV_BYPASS ?? 'false',


  // Persistence switch
  PERSISTENCE: (process.env.PERSISTENCE ?? "memory") as "memory" | "mysql",

  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT ?? 3306),
  DB_USER: process.env.DB_USER ?? "",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: process.env.DB_NAME ?? "mux",
};