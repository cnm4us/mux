// api/src/services/webhooks/mux.service.ts
import type { VideosMySqlRepo } from "../../repositories/videos.mysql.js";

type MuxPlaybackId = { id: string; policy: "public" | "signed" };

export type MuxEvent = {
  id?: string;                 // REQUIRED in real Mux; may be missing in dev tests
  type: string;                // e.g. "video.asset.ready"
  data?: {
    id?: string;               // asset id
    type?: string;             // "video" | etc (Mux sometimes includes)
    upload_id?: string;        // direct upload id
    playback_ids?: MuxPlaybackId[];
    duration?: number;
    errors?: { type?: string; messages?: string[] } | string;
  };
};

export class MuxWebhookService {
  constructor(private videosRepo: VideosMySqlRepo) {}

  /**
   * Returns: a concise description of what was changed (good for notes/logs)
   */
  async handleEvent(evt: MuxEvent): Promise<string> {
    const t = evt.type;
    const d = evt.data ?? {};

    switch (t) {
      case "video.upload.asset_created": {
        await this.videosRepo.markProcessing({ uploadId: d.upload_id!, assetId: d.id });
        return `processing (upload=${d.upload_id}, asset=${d.id})`;
        }

      case "video.asset.ready": {
        await this.videosRepo.markReady({
          uploadId: d.upload_id!,
          assetId: d.id!,
          playbackId: d.playback_ids?.[0]?.id ?? null,
          duration: typeof d.duration === "number" ? d.duration : null,
        });
        return `video ready (upload=${d.upload_id}, asset=${d.id}, playback=${d.playback_ids?.[0]?.id ?? "none"})`;
      }

      case "video.asset.errored": {
        await this.videosRepo.markErrored({ uploadId: d.upload_id! });
        return `video errored (upload=${d.upload_id})`;
      }
      

      // You can add more Mux events here later as needed.

      default:
        return `ignored event type: ${t}`;
    }
  }

  static extractObject(evt: MuxEvent): { objectType: string | null; objectId: string | null } {
    // Prefer asset context if present; otherwise fall back to upload
    const d = evt.data ?? {};
    const assetId = d.id ?? null;
    const uploadId = d.upload_id ?? null;
    if (assetId) return { objectType: "asset", objectId: assetId };
    if (uploadId) return { objectType: "upload", objectId: uploadId };
    return { objectType: null, objectId: null };
  }
}
