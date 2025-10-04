// src/controllers/uploads.controller.ts
import type { Request, Response } from "express";
import { VideosMySqlRepo } from "../repositories/videos.mysql.js";
import { mux } from "../services/mux/client.js";  // see note below

const videosRepo = new VideosMySqlRepo(); // <- simple singleton

export async function createUpload(req: Request & { user?: { id: number } }, res: Response) {
  try {
    const title: string | null = req.body?.title ?? null;

    const userId = req.user?.id;
    const video = await videosRepo.createProvisional({ title, userId });

    const resp = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: { playback_policy: ["signed"] },
    });

    const muxUploadId =
      (resp as any)?.id ??
      (resp as any)?.data?.id ??
      (resp as any)?.upload?.id ??
      null;

    if (!muxUploadId) {
      console.error("Mux create upload returned no id. Raw response:", resp);
      return res.status(502).json({
        error: { code: "MUX_CREATE_UPLOAD_FAILED", message: "Failed to create direct upload" },
      });
    }

    await videosRepo.linkUpload({ videoId: video.id, uploadId: muxUploadId });

    return res.status(201).json({
      videoId: video.id,
      uploadId: muxUploadId,
      url: (resp as any)?.url ?? (resp as any)?.data?.url ?? null,
    });
  } catch (err) {
    console.error("Create upload failed:", err);
    return res.status(500).json({
      error: { code: "MUX_CREATE_UPLOAD_FAILED", message: "Failed to create direct upload" },
    });
  }
}
