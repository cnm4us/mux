// api/src/services/mux/playbackSigner.ts
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");

import { config } from "../../config/index.js";

/**
 * Video playback (HLS/DASH) — aud: "v"
 */
export function signPlaybackUrl(playbackId: string, ttlSeconds = 600) {
  const { MUX_SIGNING_KEY_ID: kid, MUX_SIGNING_KEY_PEM: pem } = config;
  const token = (jwt as any).sign(
    { sub: playbackId, aud: "v" },
    pem,
    { algorithm: "RS256", keyid: kid, expiresIn: `${ttlSeconds}s` }
  );
  const url = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { url, expiresAt };
}

/**
 * Thumbnail / poster image — aud: "t"
 * NOTE: For *signed* playback IDs, Mux expects transform params (time, height, etc.)
 * to be inside the JWT payload, not as query parameters.
 */
export function signThumbnailUrl(
  playbackId: string,
  opts: {
    time?: number;
    height?: number;
    width?: number;
    fitMode?: "smartcrop" | "pad" | "crop";
    format?: "jpg" | "png";
  } = {},
  ttlSeconds = 120
) {
  const { MUX_SIGNING_KEY_ID: kid, MUX_SIGNING_KEY_PEM: pem } = config;

  const format = opts.format ?? "jpg";
  const base = `https://image.mux.com/${playbackId}/thumbnail.${format}`;

  // 👉 Build claims with transforms embedded
  const claims: Record<string, any> = {
    sub: playbackId,
    aud: "t",
    // embed transforms here:
    ...(typeof opts.time === "number" ? { time: Number(opts.time) } : {}),
    ...(typeof opts.height === "number" ? { height: Number(opts.height) } : {}),
    ...(typeof opts.width === "number" ? { width: Number(opts.width) } : {}),
    ...(opts.fitMode ? { fit_mode: opts.fitMode } : { fit_mode: "smartcrop" }),
    // format is already in the path; no need to add to claims
  };

  const token = (jwt as any).sign(
    claims,
    pem,
    { algorithm: "RS256", keyid: kid, expiresIn: `${ttlSeconds}s` }
  );

  // 👉 Only *token* in the query; no time/height/etc. here
  const url = `${base}?token=${token}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { url, expiresAt };
}
