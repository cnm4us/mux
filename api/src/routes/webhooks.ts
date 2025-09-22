import type { Request, Response } from "express";
// verify Mux signature here using process.env.MUX_WEBHOOK_SECRET

export async function muxWebhook(req: Request, res: Response) {
  // req.body is a Buffer because of express.raw on this route
  // 1) verify signature header
  // 2) parse JSON
  // 3) handle asset.ready, etc.
  res.sendStatus(200);
}
