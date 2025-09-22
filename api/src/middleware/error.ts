import type { NextFunction, Request, Response } from "express";


export class HttpError extends Error {
status: number; code: string; detail?: unknown;
constructor(status: number, code: string, message: string, detail?: unknown) {
super(message); this.status = status; this.code = code; this.detail = detail;
}
}


export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
if (err instanceof HttpError) {
return res.status(err.status).json({ error: { code: err.code, message: err.message, detail: err.detail ?? null } });
}
console.error("UNHANDLED_ERROR", err);
return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" } });
}