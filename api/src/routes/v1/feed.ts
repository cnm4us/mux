import { Router } from "express";
import { listFeedPage } from "../../repositories/videos.mysql.js";


const r = Router();


// Cursor format: base64 of `${createdAtIso}|${id}`
function encodeCursor(d: Date, id: string) {
return Buffer.from(`${d.toISOString()}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(c?: string): { createdAtIso: string; id: string } | undefined {
if (!c) return undefined;
try {
const [iso, id] = Buffer.from(c, "base64url").toString("utf8").split("|");
if (!iso || !id) return undefined;
return { createdAtIso: iso, id };
} catch {
return undefined;
}
}


r.get("/v1/feed", async (req, res) => {
const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "8"), 10) || 8, 1), 24);
const cursor = decodeCursor(typeof req.query.cursor === "string" ? req.query.cursor : undefined);


const rows = await listFeedPage(limit, cursor);
const items = rows.map((r) => ({
id: r.id,
title: r.title,
playbackId: r.mux_playback_id,
durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
createdAt: r.created_at.toISOString(),
}));


let nextCursor: string | undefined;
if (rows.length === limit) {
const last = rows[rows.length - 1];
nextCursor = encodeCursor(last.created_at, last.id);
}


res.json({ items, nextCursor });
});


export default r;