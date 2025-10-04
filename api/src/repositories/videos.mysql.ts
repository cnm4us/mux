import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/mysql.js";
import type { Video } from "../types/domain.js";

// Raw row shape from MySQL (must extend RowDataPacket for mysql2 generics)
type VideoRow = RowDataPacket & {
  id: string;
  title: string | null;
  status: "pending" | "ready" | "errored" | "deleted";
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  duration_seconds: number | null;   // if you kept DECIMAL, this can also be string; change if needed
  error_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToVideo(r: VideoRow): Video {
  return {
    id: r.id,
    title: r.title,
    status: r.status, // now compatible with VideoStatus
    muxUploadId: r.mux_upload_id,
    muxAssetId: r.mux_asset_id,
    muxPlaybackId: r.mux_playback_id,
    durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    createdAt: r.created_at.toISOString(),
    // If/when you add fields to the domain, include them here:
    // updatedAt: r.updated_at.toISOString(),
    // errorReason: r.error_reason,
  };
}

export class VideosMySqlRepo {
  async createProvisional(input: { title?: string | null; now?: number; userId?: number }): Promise<Video> {
    const ts = input.now ?? Date.now();
    const id = `v_${ts}`;

    // Associate uploader if provided (requires videos.user_id in schema)
    const withUser = typeof input.userId === 'number' && Number.isFinite(input.userId);
    const sql = withUser
      ? `INSERT INTO videos (id, title, status, user_id) VALUES (:id, :title, 'pending', :userId)`
      : `INSERT INTO videos (id, title, status) VALUES (:id, :title, 'pending')`;
    const params: any = { id, title: input.title ?? null, ...(withUser ? { userId: input.userId } : {}) };
    await pool.execute<ResultSetHeader>(sql, params);

    const [rows] = await pool.execute<VideoRow[]>(
      `SELECT * FROM videos WHERE id = :id LIMIT 1`,
      { id }
    );
    return rowToVideo(rows[0]);
  }

  async linkUpload(params: { uploadId: string; videoId: string }): Promise<void> {
  const { uploadId, videoId } = params;
  const [r] = await pool.execute<ResultSetHeader>(
    `UPDATE videos
       SET mux_upload_id = :uploadId,
           updated_at = NOW(3)
     WHERE id = :videoId`,
    { uploadId, videoId }
  );
  if (r.affectedRows === 0) {
    throw new Error(`linkUpload: no row updated (videoId=${videoId})`);
  }
}

  async markReady(params: {
    uploadId: string;
    assetId: string;
    playbackId?: string | null;
    duration?: number | null;
  }): Promise<void> {
    const { uploadId, assetId, playbackId, duration } = params;
    if (!uploadId) throw new Error("markReady: uploadId is required");
    if (!assetId) throw new Error("markReady: assetId is required");

    // Update by uploadId (safer for first ready/created signal)
    await pool.execute<ResultSetHeader>(
      `
      UPDATE videos
         SET mux_asset_id    = :assetId,
             ${playbackId != null ? "mux_playback_id = :playbackId," : ""}
             ${typeof duration === "number" ? "duration_seconds = :duration," : ""}
             status          = 'ready',
             error_reason    = NULL,
             updated_at      = NOW(3)
       WHERE mux_upload_id   = :uploadId
      `,
      {
        uploadId,
        assetId,
        ...(playbackId != null ? { playbackId } : {}),
        ...(typeof duration === "number" ? { duration } : {}),
      }
    );
  }

 async markErrored(params: { uploadId: string; reason?: string | null }): Promise<void> {
  const { uploadId, reason } = params;
  if (!uploadId) throw new Error("markErrored: uploadId is required");

  await pool.execute<ResultSetHeader>(
    `
    UPDATE videos
       SET status        = 'errored',
           ${typeof reason === "string" ? "error_reason = :reason," : ""}
           updated_at    = NOW(3)
     WHERE mux_upload_id = :uploadId
       AND status <> 'ready'
       AND status <> 'deleted'
    `,
    { uploadId, ...(typeof reason === "string" ? { reason } : {}) }
  );
}

async markProcessing(params: { uploadId: string; assetId?: string | null }): Promise<void> {
  const { uploadId, assetId } = params;
  if (!uploadId) throw new Error("markProcessing: uploadId is required");

  await pool.execute<ResultSetHeader>(
    `
    UPDATE videos
       SET ${assetId ? "mux_asset_id = :assetId," : ""}
           status      = 'processing',
           updated_at  = NOW(3)
     WHERE mux_upload_id = :uploadId
       AND status IN ('pending','processing')  -- do not regress ready/errored/deleted
    `,
    { uploadId, ...(assetId ? { assetId } : {}) }
  );
}

  async getById(id: string): Promise<Video | null> {
    const [rows] = await pool.execute<VideoRow[]>(
      `SELECT * FROM videos WHERE id = :id LIMIT 1`,
      { id }
    );
    return rows[0] ? rowToVideo(rows[0]) : null;
  }

  async getByUploadId(uploadId: string): Promise<Video | null> {
    const [rows] = await pool.execute<VideoRow[]>(
      `SELECT * FROM videos WHERE mux_upload_id = :uploadId LIMIT 1`,
      { uploadId }
    );
    return rows[0] ? rowToVideo(rows[0]) : null;
  }

  async listFeed(limit: number): Promise<Video[]> {
    const [rows] = await pool.execute<VideoRow[]>(
      `
      SELECT * FROM videos
       WHERE status = 'ready'
       ORDER BY created_at DESC
       LIMIT :limit
      `,
      { limit }
    );
    return rows.map(rowToVideo);
  }

  async listByUser(userId: number, limit = 50, offset = 0): Promise<Video[]> {
    const [rows] = await pool.execute<VideoRow[]>(
      `
      SELECT * FROM videos
       WHERE user_id = :userId
       ORDER BY created_at DESC, id DESC
       LIMIT :limit OFFSET :offset
      `,
      { userId, limit, offset }
    );
    return rows.map(rowToVideo);
  }

  async softDeleteByOwner(userId: number, videoId: string): Promise<boolean> {
    const [r] = await pool.execute<ResultSetHeader>(
      `UPDATE videos
         SET status = 'deleted', updated_at = NOW(3)
       WHERE id = :id AND user_id = :uid AND status <> 'deleted'`,
      { id: videoId, uid: userId }
    );
    return (r as ResultSetHeader).affectedRows > 0;
  }
}

// ADD (near bottom)
export type FeedItemRow = RowDataPacket & {
  id: string;
  title: string | null;
  mux_playback_id: string | null;
  duration_seconds: number | null;
  created_at: Date;
};


export async function listFeedPage(
  limit: number,
  before?: { createdAtIso: string; id: string }
  ): Promise<FeedItemRow[]> {
  const params: any = { limit };


  if (!before) {
    const [rows] = await pool.execute<FeedItemRow[]>(
      `SELECT id, title, mux_playback_id, duration_seconds, created_at
      FROM videos
      WHERE status = 'ready'
      ORDER BY created_at DESC, id DESC
      LIMIT :limit`,
      params
    );
  return rows;
}


// MySQL tuple comparison for stable pagination
params.createdAt = new Date(before.createdAtIso);
params.id = before.id;
const [rows] = await pool.execute<FeedItemRow[]>(
  `SELECT id, title, mux_playback_id, duration_seconds, created_at
  FROM videos
  WHERE status = 'ready'
  AND (created_at < :createdAt OR (created_at = :createdAt AND id < :id))
  ORDER BY created_at DESC, id DESC
  LIMIT :limit`,
  params
);
return rows;
}
