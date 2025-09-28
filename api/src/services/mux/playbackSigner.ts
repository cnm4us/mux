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
  const { MUX_SIGNING_KEY_ID: kid, MUX_SIGNING_KEY_PEM: pem, THUMBNAIL } = config;

  const format = opts.format ?? THUMBNAIL.FORMAT ?? "jpg";
  const base = `https://image.mux.com/${playbackId}/thumbnail.${format}`;

  // 👉 Build claims with transforms embedded
  const claims: Record<string, any> = {
    sub: playbackId,
    aud: "t",
    // embed transforms here:
    ...(typeof (opts.time ?? THUMBNAIL.TIME_SECONDS) === "number"
      ? { time: Number(opts.time ?? THUMBNAIL.TIME_SECONDS) }
      : {}),
    ...(typeof (opts.height ?? THUMBNAIL.HEIGHT) === "number"
      ? { height: Number(opts.height ?? THUMBNAIL.HEIGHT) }
      : {}),
    ...(typeof (opts.width ?? THUMBNAIL.WIDTH) === "number"
      ? { width: Number(opts.width ?? THUMBNAIL.WIDTH) }
      : {}),
    ...(opts.fitMode ? { fit_mode: opts.fitMode } : { fit_mode: THUMBNAIL.FIT_MODE ?? "smartcrop" }),
    // format is already in the path; no need to add to claims
  };

  const token = (jwt as any).sign(
    claims,
    pem,
    { algorithm: "RS256", keyid: kid, expiresIn: `${ttlSeconds || THUMBNAIL.TTL_SECONDS || 120}s` }
  );

  // 👉 Only *token* in the query; no time/height/etc. here
  const url = `${base}?token=${token}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { url, expiresAt };
}
