import { Router } from "express";
import { logSink } from "../../controllers/debug.controller.js";

const r = Router();
r.post("/_log", logSink);            // => /api/v1/_log
export default r;