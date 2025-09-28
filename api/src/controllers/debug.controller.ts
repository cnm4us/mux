import type { Request, Response } from "express";

export async function logSink(req: Request, res: Response) {
  try {
    const ua = req.header("user-agent");
    // Keep it short to avoid noisy logs
    console.log("[FE LOG]", { ua, ...req.body });
    return res.sendStatus(204);
  } catch (e) {
    console.error("logSink error:", e);
    return res.sendStatus(500);
  }
}