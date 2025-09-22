import type { Request, Response } from "express";
import { signPlaybackUrl } from "../services/mux/playbackSigner.js";

export async function playByPlaybackId(req: Request, res: Response) {
  try {
    const playbackId = req.params.playbackId;
    if (!playbackId) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing playbackId" } });
    }
    const grant = signPlaybackUrl(playbackId, 600);
    return res.json({ playback: grant });
  } catch (e: any) {
    console.error("SIGNED URL ERROR:", e);
    return res.status(500).json({ error: { code: "SIGN_PLAYBACK_FAILED", message: String(e?.message || e) } });
  }
}