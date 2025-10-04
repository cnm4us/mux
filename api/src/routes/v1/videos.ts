import { Router } from "express";
import { getFeed, playByVideoId, listMyVideos, deleteMyVideo } from "../../controllers/videos.controller.js";
import { requireAuth } from "../../auth/session.js";

const r = Router();
r.get("/feed", getFeed);                   // GET /api/v1/feed
r.get("/videos/:id/play", playByVideoId);  // keep legacy route for now
// My uploads (auth required)
r.get("/me/videos", requireAuth as any, listMyVideos as any);
// Delete own video (soft delete)
r.delete("/me/videos/:id", requireAuth as any, deleteMyVideo as any);
export default r;
