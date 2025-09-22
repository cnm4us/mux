import { Router } from "express";
import { createUpload } from "../../controllers/uploads.controller.js";

const r = Router();
r.post("/uploads", createUpload);
export default r;