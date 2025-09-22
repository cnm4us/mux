export interface FeedItemDTO {
id: string;
title: string | null;
status: "ready";
createdAt: string;
duration: number | null;
thumbnailUrl: string | null;
}


export interface PlaybackGrantRequest {
videoId?: string;
playbackId?: string;
ttlSeconds?: number; // default 600
}


export interface PlaybackGrantResponse {
playback: { url: string; expiresAt: string };
}