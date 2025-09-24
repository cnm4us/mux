// api/src/routes/v1/webhooks/mux.ts
import type { Request, Response } from "express";
import express from "express";
import { verifyMuxSignature } from "../../../services/mux/webhookVerifier.js";
import { config } from "../../../config/index.js";
import { getRepos } from "../../../wiring/repos.js";
import { WebhookEventsRepo } from "../../../repositories/webhookEvents.mysql.js";
import { MuxWebhookService, type MuxEvent } from "../../../services/webhooks/mux.service.js";

const raw = express.raw({ type: "*/*" });

export default [raw, async (req: Request, res: Response) => {
  const provider = "mux" as const;
  const { videosRepo } = getRepos();
  const eventsRepo = new WebhookEventsRepo();
  const svc = new MuxWebhookService(videosRepo);

  try {
    const rawBody = req.body as Buffer;
    const sigHeader = req.header("Mux-Signature") || req.header("mux-signature") || "";
    const devBypass = config.MUX_WEBHOOK_DEV_BYPASS === "true";

    // 1) Signature verification (strict in prod, bypass in dev)
    const verified = verifyMuxSignature(rawBody, sigHeader, config.MUX_WEBHOOK_SECRET);
    if (!verified && !devBypass) {
      return res.status(400).json({ error: { code: "INVALID_SIGNATURE", message: "Mux signature invalid" } });
    }

    // 2) Parse JSON
    const evt: MuxEvent = JSON.parse(rawBody.toString("utf8"));

    // 3) Compute payload SHA and persist full payload (separate table)
    const payloadSha = eventsRepo.sha256(rawBody);
    await eventsRepo.insertPayloadIfNew(provider, payloadSha, rawBody.toString("utf8"));

    // 4) Determine event_id, object mapping
    //    Real Mux supplies evt.id; for local tests, allow fallback to SHA
    const eventId = evt.id || `sha:${payloadSha}`;
    const { objectType, objectId } = MuxWebhookService.extractObject(evt);

    // 5) Insert into webhook_events (idempotent)
    const ins = await eventsRepo.insertReceived({
      provider,
      eventId,
      type: evt.type,
      objectType,
      objectId,
      payloadSha,
      notes: null,
    });

    if (ins === "duplicate") {
      // Short-circuit per your policy A
      return res.sendStatus(200);
    }

    // 6) Dispatch to domain service (updates your videos table)
    const note = await svc.handleEvent(evt);

    // 7) Mark handled
    await eventsRepo.markHandled(provider, eventId);

    // Optional: include note in response for easier local debugging
    return res.status(200).json({ ok: true, note });
  } catch (e) {
    console.error("Mux webhook error:", e);
    // For transient errors, 5xx lets Mux retry. Keep this behavior.
    return res.sendStatus(500);
  }
}] as any;
