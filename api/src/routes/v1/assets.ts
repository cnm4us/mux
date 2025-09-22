import { Router } from "express";
import { addSignedPlayback, getAsset } from "../../controllers/assets.controller.js";

const r = Router();
r.post("/assets/:assetId/add-signed", addSignedPlayback);
r.get("/assets/:assetId", getAsset);
export default r;