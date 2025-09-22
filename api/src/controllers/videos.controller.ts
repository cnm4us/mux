import type { Request, Response } from "express";
import { getRepos } from "../wiring/repos.js";
import { signPlaybackUrl } from "../services/mux/playbackSigner.js";

export async function getFeed(_req: Request, res: Response) {
  const { videosRepo } = getRepos();
  const items = (await videosRepo.listFeed(20)).map(v => ({
    id: v.id,
    title: v.title,
    status: v.status, // "ready"
    createdAt: v.createdAt,
    duration: v.durationSeconds ?? null,
    thumbnailUrl: v.muxPlaybackId
      ? `https://image.mux.com/${v.muxPlaybackId}/thumbnail.jpg?time=1`
      : null
  }));
  return res.json({ items, nextCursor: null });
}

export async function playByVideoId(req: Request, res: Response) {
  const { videosRepo } = getRepos();
  const v = await videosRepo.getById(req.params.id);
  if (!v || v.status !== "ready" || !v.muxPlaybackId) {
    return res.status(404).json({ error: { code: "VIDEO_NOT_READY", message: "Not found or not ready" } });
  }
  const grant = signPlaybackUrl(v.muxPlaybackId, 600);
  return res.json({ playback: grant });
}