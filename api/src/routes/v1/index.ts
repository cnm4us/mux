import { Router } from "express";
import uploads from "./uploads.js";
import videos from "./videos.js";
import playback from "./playback-grants.js";
import assets from "./assets.js";
import muxWebhook from "./webhooks/mux.js";
import debug from "./debug.js";
import auth from "./auth.js";

const r = Router();

// Normal routes
r.use(uploads);
r.use(videos);
r.use(playback);
r.use(assets);
r.use(auth);
r.use("/", debug); 

export default r;
