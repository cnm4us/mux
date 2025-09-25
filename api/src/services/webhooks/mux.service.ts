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

function pickIds(evt: any) {
  const d = evt.data ?? {};
  const obj = evt.object ?? {};
  const uploadId =
    d.upload_id            // present on video.asset.*
    || (obj.type === "upload" ? obj.id : null)   // present on video.upload.*
    || d.id                // present on video.upload.* payloads
    || null;

  const assetId =
    d.asset_id             // present on video.upload.asset_created
    || (obj.type === "asset" ? obj.id : null)    // present on video.asset.*
    || d.id                // sometimes in asset.* payloads
    || null;

  return { uploadId, assetId };
}


export class MuxWebhookService {
  constructor(private videosRepo: VideosMySqlRepo) {}

  

  /**
   * Returns: a concise description of what was changed (good for notes/logs)
   */
  async handleEvent(evt: MuxEvent & { object?: { type?: string; id?: string } }): Promise<string> {
  const d = evt.data ?? {};
  const { uploadId, assetId } = pickIds(evt);

  switch (evt.type) {
    case "video.upload.created": {
      // no DB mutation required
      return `upload created (upload=${uploadId ?? "none"})`;
    }

    case "video.upload.asset_created": {
      // Only when we actually have the upload id
      if (uploadId) {
        await this.videosRepo.markProcessing({ uploadId, assetId });
        return `processing (upload=${uploadId}, asset=${assetId ?? "none"})`;
      }
      return `noop: asset_created (no upload_id, asset=${assetId ?? "none"})`;
    }

    case "video.asset.created": {
      // Redundant with the above in many cases, but safe to set processing too
      if (uploadId) {
        await this.videosRepo.markProcessing({ uploadId, assetId });
        return `processing (upload=${uploadId}, asset=${assetId ?? "none"})`;
      }
      return `noop: asset.created (no upload_id, asset=${assetId ?? "none"})`;
    }

    case "video.asset.ready": {
      await this.videosRepo.markReady({
        uploadId: uploadId!,              // present on this event
        assetId: assetId!,                // asset id
        playbackId: d.playback_ids?.[0]?.id ?? null,
        duration: typeof d.duration === "number" ? d.duration : null,
      });
      return `video ready (upload=${uploadId}, asset=${assetId}, playback=${d.playback_ids?.[0]?.id ?? "none"})`;
    }

    case "video.asset.errored": {
      const reason =
        typeof d.errors === "string" ? d.errors :
        Array.isArray(d.errors?.messages) ? d.errors.messages.join("; ") :
        d.errors?.type ?? null;
      if (uploadId) await this.videosRepo.markErrored({ uploadId, reason });
      return `video errored (upload=${uploadId ?? "none"})`;
    }

    default:
      return `ignored event type: ${evt.type}`;
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
