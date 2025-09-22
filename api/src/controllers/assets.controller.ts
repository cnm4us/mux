import type { Request, Response } from "express";
import { mux } from "../services/mux/index.js";

export async function addSignedPlayback(req: Request, res: Response) {
  try {
    const assetId = req.params.assetId;
    if (!assetId) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing assetId" } });

    const playback = await mux.video.assets.createPlaybackId(assetId, { policy: "signed" });
    return res.status(201).json({ playbackId: playback.id, policy: playback.policy });
  } catch (e: any) {
    console.error("ADD_SIGNED_FAILED:", e?.response?.data ?? e);
    return res.status(500).json({ error: { code: "ADD_SIGNED_FAILED", message: "Failed to add signed playback id" } });
  }
}

export async function getAsset(req: Request, res: Response) {
  try {
    const asset = await mux.video.assets.retrieve(req.params.assetId);
    return res.json({
      id: asset.id,
      status: asset.status,
      playback_ids: asset.playback_ids?.map(p => ({ id: p.id, policy: p.policy }))
    });
  } catch (e: any) {
    console.error("Retrieve asset failed:", e?.response?.data ?? e);
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asset not found" } });
  }
}