function must(name: string, v: string | undefined): string {
if (!v) throw new Error(`Missing required env: ${name}`);
return v;
}


export const config = {
NODE_ENV: process.env.NODE_ENV ?? "development",
PORT: Number(process.env.PORT ?? 3200),
HOST: process.env.HOST ?? "127.0.0.1",


CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean),


// Mux server API
MUX_TOKEN_ID: must("MUX_TOKEN_ID", process.env.MUX_TOKEN_ID),
MUX_TOKEN_SECRET: must("MUX_TOKEN_SECRET", process.env.MUX_TOKEN_SECRET),


// Playback signing
MUX_SIGNING_KEY_ID: must("MUX_SIGNING_KEY_ID", process.env.MUX_SIGNING_KEY_ID),
MUX_SIGNING_KEY_PEM: (() => {
const file = process.env.MUX_SIGNING_KEY_FILE;
const envPem = process.env.MUX_SIGNING_KEY_PRIVATE_KEY;
if (envPem) return envPem.replace(/\\n/g, "\n");
if (!file) throw new Error("MUX_SIGNING_KEY_FILE or MUX_SIGNING_KEY_PRIVATE_KEY required");
// Lazy read (sync acceptable at boot). If you prefer async, move this out.
return require("node:fs").readFileSync(file, "utf8");
})(),


// Webhooks
MUX_WEBHOOK_SECRET: must("MUX_WEBHOOK_SECRET", process.env.MUX_WEBHOOK_SECRET),


// Persistence switch
PERSISTENCE: (process.env.PERSISTENCE ?? "memory") as "memory" | "mysql",
};