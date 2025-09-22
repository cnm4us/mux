import dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/mux/api/.env", override: true });
import express from "express";
import cors from "cors";
import Mux from "@mux/mux-node";

// ✅ ESM-safe import for CommonJS jsonwebtoken
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");

import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";

console.log("[env] MUX_SIGNING_KEY_ID =", process.env.MUX_SIGNING_KEY_ID);


/** ---------- POC in-memory store (replace with MySQL later) ---------- */
type VideoPOC = {
  id: string; // v_<ts>
  title: string | null;
  status: "uploading" | "ready" | "errored";
  muxUploadId?: string | null;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  durationSeconds?: number | null;
  createdAt: string; // ISO
};
const videos = new Map<string, VideoPOC>();   // videoId -> video
const byUploadId = new Map<string, string>(); // mux upload id -> videoId

/** ---------- App + middleware ---------- */
const app = express();

// CORS for your SPA(s)
const origins =
  process.env.CORS_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
app.use(cors({ origin: origins }));

// helper: surface Mux API errors clearly
function muxErr(e: any) {
  const data = e?.response?.data ?? e?.data ?? e?.message ?? e;
  console.error("MUX ERROR:", JSON.stringify(data, null, 2));
  return { error: { code: "ADD_SIGNED_FAILED", message: "Failed to add signed playback id", detail: data } };
}

function loadSigningKey(): { kid?: string; pem?: string; diag: any } {
  const kid = process.env.MUX_SIGNING_KEY_ID;
  const file = process.env.MUX_SIGNING_KEY_FILE;
  const envPem = process.env.MUX_SIGNING_KEY_PRIVATE_KEY;
  let pem: string | undefined;

  if (file && existsSync(file)) {
    pem = readFileSync(file, "utf8");
  } else if (envPem) {
    pem = envPem.replace(/\\n/g, "\n");
  }

  return {
    kid,
    pem,
    diag: {
      haveKID: !!kid,
      haveFile: !!file,
      fileExists: !!(file && existsSync(file)),
      haveEnvPem: !!envPem,
    },
  };
}



/** ---------- Webhook (raw body BEFORE json()) ---------- */
app.post("/api/webhooks/mux", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    // TODO: verify "Mux-Signature" using process.env.MUX_WEBHOOK_SECRET
    const evt = JSON.parse(req.body.toString("utf8"));

    if (evt.type === "video.asset.ready") {
      const data = evt.data ?? {};
      const uploadId: string | undefined = data.upload_id;
      const playbackId: string | undefined = data.playback_ids?.[0]?.id;
      const assetId: string | undefined = data.id;
      const duration: number | undefined = data.duration;

      if (uploadId) {
        const videoId = byUploadId.get(uploadId);
        if (videoId) {
          const v = videos.get(videoId);
          if (v) {
            v.status = "ready";
            v.muxAssetId = assetId ?? null;
            v.muxPlaybackId = playbackId ?? null;
            v.durationSeconds = typeof duration === "number" ? duration : null;
            videos.set(videoId, v);
          }
        }
      }
    }

    if (evt.type === "video.asset.errored") {
      const uploadId: string | undefined = evt.data?.upload_id;
      if (uploadId) {
        const videoId = byUploadId.get(uploadId);
        if (videoId) {
          const v = videos.get(videoId);
          if (v) { v.status = "errored"; videos.set(videoId, v); }
        }
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(400);
  }
});

/** ---------- JSON parser for normal routes ---------- */
app.use(express.json());

/** ---------- Mux client (server access token) ---------- */
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

/** ---------- Health ---------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/** ---------- Create Direct Upload (POC: no auth yet) ---------- */
app.post("/api/uploads", async (req, res) => {
  try {
    const { title } = (req.body ?? {}) as { title?: string };

    // 1) Create provisional video record
    const now = Date.now();
    const videoId = `v_${now}`;
    const v: VideoPOC = {
      id: videoId,
      title: title ?? null,
      status: "uploading",
      createdAt: new Date(now).toISOString(),
    };
    videos.set(videoId, v);

    // 2) Create a Direct Upload that results in an Asset with SIGNED playback policy
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["signed"],
      },
      cors_origin: process.env.APP_ORIGIN ?? "https://mux.bawebtech.com",
      timeout: 60 * 60, // 1 hour
    });

    // 3) Link upload → video
    byUploadId.set(upload.id, videoId);
    v.muxUploadId = upload.id;
    videos.set(videoId, v);

    return res.status(201).json({
      video: { id: v.id, title: v.title, status: v.status, createdAt: v.createdAt },
      directUpload: {
        id: upload.id,
        url: upload.url,
        expiresAt: upload.timeout
          ? new Date(Date.now() + upload.timeout * 1000).toISOString()
          : null,
      },
    });
  } catch (err: any) {
    console.error("Create upload failed:", err?.response?.data ?? err);
    return res
      .status(500)
      .json({ error: { code: "MUX_CREATE_UPLOAD_FAILED", message: "Failed to create direct upload" } });
  }
});

/** ---------- Feed (ready videos) ---------- */
app.get("/api/feed", (_req, res) => {
  const items = Array.from(videos.values())
    .filter(v => v.status === "ready")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20)
    .map(v => ({
      id: v.id,
      title: v.title,
      status: v.status,
      createdAt: v.createdAt,
      duration: v.durationSeconds ?? null,
      thumbnailUrl: v.muxPlaybackId
        ? `https://image.mux.com/${v.muxPlaybackId}/thumbnail.jpg?time=1`
        : null,
    }));

  return res.json({ items, nextCursor: null });
});

/** ---------- Signed playback URL (local video id) ---------- */
app.get("/api/videos/:id/play", (req, res) => {
  const video = videos.get(req.params.id);
  if (!video || video.status !== "ready" || !video.muxPlaybackId) {
    return res.status(404).json({ error: { code: "VIDEO_NOT_READY", message: "Not found or not ready" } });
  }

  const { kid, pem, diag } = loadSigningKey();
  if (!kid || !pem) {
    return res.status(500).json({ error: { code: "SIGNING_KEY_MISSING", message: "Mux signing key not configured" }, diag });
  }

  const token = (jwt as any).sign(
    { sub: video.muxPlaybackId, aud: "v"},
    pem,
    { algorithm: "RS256", keyid: kid, expiresIn: "10m" }
  );

  const url = `https://stream.mux.com/${video.muxPlaybackId}.m3u8?token=${token}`;
  return res.json({ playback: { url, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() } });
});

/** ---------- Convenience: play by playbackId ---------- */
app.get("/api/playback/:playbackId/play", (req, res) => {
  try {
    const playbackId = req.params.playbackId;
    const { kid, pem, diag } = loadSigningKey();

    if (!playbackId) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing playbackId" }, diag });
    }
    if (!kid || !pem) {
      return res.status(500).json({ error: { code: "SIGNING_KEY_MISSING", message: "Missing signing key" }, diag });
    }

    const token = (jwt as any).sign(
      { sub: playbackId, aud: "v" },
      pem,
      { algorithm: "RS256", keyid: kid, expiresIn: "10m" }
    );

    const url = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
    return res.json({ playback: { url, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }, diag });
  } catch (e: any) {
    console.error("SIGNED URL ERROR:", e);
    return res.status(500).json({ error: { code: "SIGN_PLAYBACK_FAILED", message: String(e?.message || e) } });
  }
});



// POST /api/assets/:assetId/add-signed
app.post("/api/assets/:assetId/add-signed", async (req, res) => {
  try {
    const assetId = req.params.assetId;
    if (!assetId) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing assetId" } });
    }

    // ✅ Correct SDK call in v8
    const playback = await mux.video.assets.createPlaybackId(assetId, { policy: "signed" });

    return res.status(201).json({ playbackId: playback.id, policy: playback.policy });
  } catch (e: any) {
    console.error("ADD_SIGNED_FAILED:", e?.response?.data ?? e);
    return res.status(500).json({ error: { code: "ADD_SIGNED_FAILED", message: "Failed to add signed playback id" } });
  }
});

// GET /api/assets/:assetId
app.get("/api/assets/:assetId", async (req, res) => {
  try {
    const asset = await mux.video.assets.retrieve(req.params.assetId);
    return res.json({
      id: asset.id,
      status: asset.status,
      playback_ids: asset.playback_ids?.map(p => ({ id: p.id, policy: p.policy })),
    });
  } catch (e: any) {
    console.error("Retrieve asset failed:", e?.response?.data ?? e);
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asset not found" } });
  }
});

app.get("/api/debug/signing", async (_req, res) => {
  try {
    const kid = process.env.MUX_SIGNING_KEY_ID;
    const file = process.env.MUX_SIGNING_KEY_FILE;
    const pem = file ? await fs.readFile(file, "utf8") : "";
    const pemHeader = pem.split("\n")[0] || null;
    res.json({ kid, file, pemHeader });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});



/** ---------- Start ---------- */
const port = Number(process.env.PORT || 3200);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`API listening on ${host}:${port} (ESM)`);
});
