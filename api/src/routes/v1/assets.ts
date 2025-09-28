import { Router } from "express";
import {
  addSignedPlayback,
  getAsset,
  getPosterSigned,   // ← add this import
} from "../../controllers/assets.controller.js";

const r = Router();

// Create a *signed* playback ID on an asset (admin action)
r.post("/assets/:assetId/add-signed", addSignedPlayback);

// Return a *signed* thumbnail/poster URL for a given playbackId
// e.g. GET /api/v1/assets/<playbackId>/poster?time=1&height=900
r.get("/assets/:playbackId/poster", getPosterSigned);

// Basic asset details (status + playback IDs)
r.get("/assets/:assetId", getAsset);

export default r;
