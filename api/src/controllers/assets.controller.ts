import type { Request, Response } from "express";
import { mux } from "../services/mux/index.js";
import { signThumbnailUrl } from "../services/mux/playbackSigner.js";
import { config } from "../config/index.js";

/**
 * POST /api/v1/assets/:assetId/playback
 * Create a *signed* playback ID on an Asset (one-time admin action).
 */
export async function addSignedPlayback(req: Request, res: Response) {
  try {
    const assetId = req.params.assetId;
    if (!assetId) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing assetId" } });
    }
    const playback = await mux.video.assets.createPlaybackId(assetId, { policy: "signed" });
    return res.status(201).json({ playbackId: playback.id, policy: playback.policy });
  } catch (e: any) {
    console.error("ADD_SIGNED_FAILED:", e?.response?.data ?? e);
    return res.status(500).json({ error: { code: "ADD_SIGNED_FAILED", message: "Failed to add signed playback id" } });
  }
}

/**
 * GET /api/v1/assets/:assetId
 * Lightweight asset details (status + playback IDs).
 */
export async function getAsset(req: Request, res: Response) {
  try {
    const asset = await mux.video.assets.retrieve(req.params.assetId);
    return res.json({
      id: asset.id,
      status: asset.status,
      playback_ids: asset.playback_ids?.map((p) => ({ id: p.id, policy: p.policy })),
    });
  } catch (e: any) {
    console.error("Retrieve asset failed:", e?.response?.data ?? e);
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asset not found" } });
  }
}

/**
 * GET /api/v1/assets/:playbackId/poster?time=1&height=900
 * Returns a *signed* thumbnail/poster URL for a given playbackId (policy: signed).
 * Uses Mux Image API (aud "t").
 */
export async function getPosterSigned(req: Request, res: Response) {
  try {
    const { playbackId } = req.params;
    if (!playbackId) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing playbackId" } });

    const time = req.query.time != null
      ? Number(req.query.time)
      : config.THUMBNAIL.TIME_SECONDS;
    const height = req.query.height != null
      ? Number(req.query.height)
      : (config.THUMBNAIL.HEIGHT as number | undefined);
    const width = req.query.width != null
      ? Number(req.query.width)
      : (config.THUMBNAIL.WIDTH as number | undefined);
    const fitMode = (req.query.fit_mode as "smartcrop" | "pad" | "crop")
      ?? config.THUMBNAIL.FIT_MODE;
    const format = (req.query.format as "jpg" | "png")
      ?? config.THUMBNAIL.FORMAT;
    const ttl = req.query.ttl != null
      ? Number(req.query.ttl)
      : config.THUMBNAIL.TTL_SECONDS;  // default; still overrideable per-request

    const { url, expiresAt } = signThumbnailUrl(playbackId, { time, height, width, fitMode, format }, ttl);

    return res.json({ url, expiresAt });
  } catch (e: any) {
    console.error("POSTER_SIGN_FAILED:", e);
    return res.status(500).json({ error: { code: "POSTER_SIGN_FAILED", message: "Could not sign poster URL" } });
  }
}
