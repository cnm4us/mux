import { Router } from "express";
import { muxWebhook } from "./webhooks.js";

const router = Router();

// Webhook (mounted at /api/webhooks/mux externally)
router.post("/webhooks/mux", muxWebhook);

// …other routes, e.g. router.get("/feed", ...)
export default router;
