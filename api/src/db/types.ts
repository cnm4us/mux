import type { RowDataPacket } from "mysql2/promise";

export type VideoRow = RowDataPacket & {
  id: string;
  title: string | null;
  status: "pending" | "ready" | "errored" | "deleted";
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  duration_seconds: number | null;
  error_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type Video = {
  id: string;
  title: string | null;
  status: "pending" | "ready" | "errored" | "deleted";
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  durationSeconds: number | null;
  errorReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapVideoRow(r: VideoRow): Video {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    muxUploadId: r.mux_upload_id,
    muxAssetId: r.mux_asset_id,
    muxPlaybackId: r.mux_playback_id,
    durationSeconds: r.duration_seconds,
    errorReason: r.error_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
