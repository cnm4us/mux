export type VideoStatus = "uploading" | "ready" | "errored";


export interface Video {
id: string; // v_<ts> (POC) — later ULID/UUIDv7
title: string | null;
status: VideoStatus;
muxUploadId?: string | null;
muxAssetId?: string | null;
muxPlaybackId?: string | null;
durationSeconds?: number | null;
createdAt: string; // ISO
}


export interface DirectUpload {
id: string;
url: string;
expiresAt: string | null; // ISO
}