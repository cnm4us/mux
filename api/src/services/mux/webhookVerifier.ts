import crypto from "node:crypto";


/**
* Minimal placeholder. For production, use Mux's recommended scheme.
* Verifies the signature header against the raw body and a shared secret.
*/
export function verifyMuxSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
if (!signatureHeader) return false;
const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
// Very naive example: compare to a single 'sig' value. Replace with real parser as you harden.
const provided = signatureHeader.split("=").pop()?.trim();
return provided === expected;
}