import { Router } from "express";
import { createUpload } from "../../controllers/uploads.controller.js";
import { requireAuth } from "../../auth/session.js";

const r = Router();
// Require auth to associate uploader
r.post("/uploads", requireAuth as any, createUpload as any);
export default r;
