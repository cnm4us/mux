import type { Video } from "../types/domain.js";


export interface VideosRepo {
createProvisional(input: { title?: string | null; now?: number }): Promise<Video>;
linkUpload(params: { uploadId: string; videoId: string }): Promise<void>;
markReady(params: { uploadId: string; assetId: string; playbackId?: string | null; duration?: number | null }): Promise<void>;
markErrored(params: { uploadId: string }): Promise<void>;
getById(id: string): Promise<Video | null>;
getByUploadId(uploadId: string): Promise<Video | null>;
listFeed(limit: number): Promise<Video[]>; // already filtered to status=ready, newest first
}
