import type { Request, Response } from "express";
import { mux } from "../services/mux/index.js";
import { getRepos } from "../wiring/repos.js";
import { config } from "../config/index.js";

export async function createUpload(req: Request, res: Response) {
  try {
    const title = (req.body?.title ?? null) as string | null;

    const { videosRepo } = getRepos();
    const v = await videosRepo.createProvisional({ title });

    const upload = await mux.video.uploads.create({
      new_asset_settings: { playback_policy: ["signed"] },
      cors_origin: process.env.APP_ORIGIN ?? "https://mux.bawebtech.com",
      timeout: 60 * 60
    });

    await videosRepo.linkUpload({ uploadId: upload.id, videoId: v.id });

    return res.status(201).json({
      video: { id: v.id, title: v.title, status: v.status, createdAt: v.createdAt },
      directUpload: {
        id: upload.id,
        url: upload.url,
        expiresAt: upload.timeout
          ? new Date(Date.now() + upload.timeout * 1000).toISOString()
          : null
      }
    });
  } catch (err: any) {
    console.error("Create upload failed:", err?.response?.data ?? err);
    return res.status(500).json({
      error: { code: "MUX_CREATE_UPLOAD_FAILED", message: "Failed to create direct upload" }
    });
  }
}