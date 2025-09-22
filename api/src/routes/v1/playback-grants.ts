import { Router } from "express";
import { playByPlaybackId } from "../../controllers/playback.controller.js";

const r = Router();
r.get("/playback/:playbackId/play", playByPlaybackId); // keep legacy route
export default r;