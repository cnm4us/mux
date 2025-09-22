import type { Request, Response } from "express";
import express from "express";
import { verifyMuxSignature } from "../../../services/mux/webhookVerifier.js";
import { config } from "../../../config/index.js";
import { getRepos } from "../../../wiring/repos.js"; // tiny helper (below)

const raw = express.raw({ type: "*/*" });

export default [raw, async (req: Request, res: Response) => {
  try {
    // Optional: enable verification when you’re ready
    const ok = verifyMuxSignature(
      req.body as Buffer,
      req.header("Mux-Signature"),
      config.MUX_WEBHOOK_SECRET
    );
    if (!ok) {
      // For initial POC you might return 200; to enforce, switch to 400.
      // return res.status(400).json({ error: { code: "INVALID_SIGNATURE", message: "Mux signature invalid" } });
    }

    const evt = JSON.parse((req.body as Buffer).toString("utf8"));
    const { videosRepo } = getRepos();

    if (evt.type === "video.asset.ready") {
      const d = evt.data ?? {};
      await videosRepo.markReady({
        uploadId: d.upload_id,
        assetId: d.id,
        playbackId: d.playback_ids?.[0]?.id ?? null,
        duration: typeof d.duration === "number" ? d.duration : null
      });
    }

    if (evt.type === "video.asset.errored") {
      const d = evt.data ?? {};
      if (d.upload_id) await videosRepo.markErrored({ uploadId: d.upload_id });
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    return res.sendStatus(400);
  }
}] as any;