import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");


import { config } from "../../config/index.js";


export function signPlaybackUrl(playbackId: string, ttlSeconds = 600) {
const { MUX_SIGNING_KEY_ID: kid, MUX_SIGNING_KEY_PEM: pem } = config;
const token = (jwt as any).sign({ sub: playbackId, aud: "v" }, pem, { algorithm: "RS256", keyid: kid, expiresIn: `${ttlSeconds}s` });
const url = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
return { url, expiresAt };
}