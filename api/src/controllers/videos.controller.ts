import type { Request, Response } from "express";
import { getRepos } from "../wiring/repos.js";
import { config } from "../config/index.js";
import { signPlaybackUrl } from "../services/mux/playbackSigner.js";
import { requireAuth } from "../auth/session.js";

export async function getFeed(_req: Request, res: Response) {
  const { videosRepo } = getRepos();
  const items = (await videosRepo.listFeed(20)).map(v => ({
    id: v.id,
    title: v.title,
    status: v.status, // "ready"
    createdAt: v.createdAt,
    duration: v.durationSeconds ?? null,
    thumbnailUrl: v.muxPlaybackId
      ? `https://image.mux.com/${v.muxPlaybackId}/thumbnail.jpg?time=${encodeURIComponent(String(config.THUMBNAIL.TIME_SECONDS ?? 1))}`
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

export async function listMyVideos(req: Request & { user?: { id: number } }, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: 'unauthorized' });
  const { videosRepo } = getRepos();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const vids = await (videosRepo as any).listByUser(req.user.id, limit, offset);
  const items = vids.map((v: any) => ({
    id: v.id,
    title: v.title,
    status: v.status,
    createdAt: v.createdAt,
    playbackId: v.muxPlaybackId ?? null,
    duration: v.durationSeconds ?? null,
  }));
  return res.json({ items, nextOffset: items.length === limit ? offset + limit : null });
}

export async function deleteMyVideo(req: Request & { user?: { id: number } }, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: 'unauthorized' });
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'bad_id' });
  const { videosRepo } = getRepos();
  if (typeof (videosRepo as any).softDeleteByOwner !== 'function') {
    return res.status(501).json({ error: 'not_implemented' });
  }
  const ok = await (videosRepo as any).softDeleteByOwner(req.user.id, id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  return res.json({ ok: true });
}
