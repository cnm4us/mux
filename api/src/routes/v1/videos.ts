import { Router } from "express";
import { getFeed, playByVideoId } from "../../controllers/videos.controller.js";

const r = Router();
r.get("/feed", getFeed);                   // GET /api/v1/feed
r.get("/videos/:id/play", playByVideoId);  // keep legacy route for now
export default r;