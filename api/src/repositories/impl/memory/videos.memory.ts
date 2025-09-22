import type { VideosRepo } from "../../videos.repo.js";
import type { Video } from "../../../types/domain.js";
export class VideosMemoryRepo implements VideosRepo {
private videos = new Map<string, Video>();
private byUploadId = new Map<string, string>(); // uploadId -> videoId


async createProvisional({ title, now }: { title?: string | null; now?: number }): Promise<Video> {
const ts = now ?? Date.now();
const id = `v_${ts}`;
const v: Video = {
id,
title: title ?? null,
status: "uploading",
createdAt: new Date(ts).toISOString(),
};
this.videos.set(id, v);
return v;
}


async linkUpload({ uploadId, videoId }: { uploadId: string; videoId: string }): Promise<void> {
this.byUploadId.set(uploadId, videoId);
const v = this.videos.get(videoId);
if (v) { v.muxUploadId = uploadId; this.videos.set(videoId, v); }
}


async markReady({ uploadId, assetId, playbackId, duration }: { uploadId: string; assetId: string; playbackId?: string | null; duration?: number | null }): Promise<void> {
const vid = this.byUploadId.get(uploadId);
if (!vid) return;
const v = this.videos.get(vid);
if (!v) return;
v.status = "ready";
v.muxAssetId = assetId;
v.muxPlaybackId = playbackId ?? null;
v.durationSeconds = typeof duration === "number" ? duration : null;
this.videos.set(vid, v);
}


async markErrored({ uploadId }: { uploadId: string }): Promise<void> {
const vid = this.byUploadId.get(uploadId);
if (!vid) return;
const v = this.videos.get(vid);
if (!v) return;
v.status = "errored";
this.videos.set(vid, v);
}


async getById(id: string) { return this.videos.get(id) ?? null; }


async getByUploadId(uploadId: string) {
const vid = this.byUploadId.get(uploadId);
return vid ? (this.videos.get(vid) ?? null) : null;
}


async listFeed(limit: number): Promise<Video[]> {
return Array.from(this.videos.values())
.filter(v => v.status === "ready")
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.slice(0, limit);
}
}