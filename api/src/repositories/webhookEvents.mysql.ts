// api/src/repositories/webhookEvents.mysql.ts
import crypto from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/mysql.js";

export type WebhookEventRow = RowDataPacket & {
  id: number;
  provider: "mux";
  event_id: string;
  type: string;
  object_type: string | null;
  object_id: string | null;
  payload_sha256: string;
  handled: "0" | "1";
  received_at: Date;
  handled_at: Date;
  notes: string | null;
};

export class WebhookEventsRepo {
  sha256(buf: Buffer) {
    return crypto.createHash("sha256").update(buf).digest("hex");
  }

  async insertPayloadIfNew(provider: "mux", payloadSha: string, json: object | string): Promise<void> {
    const payload_json = typeof json === "string" ? json : JSON.stringify(json);
    await pool.execute<ResultSetHeader>(
      `
      INSERT INTO webhook_event_payloads (provider, payload_sha256, payload_json)
      VALUES (:provider, :payloadSha, :payload_json)
      ON DUPLICATE KEY UPDATE payload_sha256 = payload_sha256
      `,
      { provider, payloadSha, payload_json }
    );
  }

  async insertReceived(params: {
    provider: "mux";
    eventId: string;
    type: string;
    objectType?: string | null;
    objectId?: string | null;
    payloadSha: string;
    notes?: string | null;
  }): Promise<"inserted" | "duplicate"> {
    try {
      await pool.execute<ResultSetHeader>(
        `
        INSERT INTO webhook_events
          (provider, event_id, type, object_type, object_id, payload_sha256, handled, notes)
        VALUES
          (:provider, :eventId, :type, :objectType, :objectId, :payloadSha, '0', :notes)
        `,
        params
      );
      return "inserted";
    } catch (err: any) {
      // Duplicate based on UNIQUE KEY (provider,event_id)
      const msg = String(err?.message ?? "");
      if (msg.includes("ux_webhook_provider_event") || msg.includes("Duplicate entry")) {
        return "duplicate";
      }
      throw err;
    }
  }

  async markHandled(provider: "mux", eventId: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      `
      UPDATE webhook_events
         SET handled='1', handled_at=NOW(3)
       WHERE provider = :provider
         AND event_id = :eventId
      `,
      { provider, eventId }
    );
  }
}
