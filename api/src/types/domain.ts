export type VideoStatus = "pending" | "ready" | "errored" | "deleted";

export interface Video {
  id: string;                 // v_<ts> (POC)
  title: string | null;
  status: VideoStatus;
  muxUploadId?: string | null;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  durationSeconds?: number | null;
  createdAt: string;          // ISO
  // optional extras if/when you want them:
  // updatedAt?: string;
  // errorReason?: string | null;
}

export interface DirectUpload {
  id: string;
  url: string;
  expiresAt: string | null;   // ISO
}
