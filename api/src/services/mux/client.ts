import "dotenv/config";
import Mux from "@mux/mux-node";

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

if (!tokenId || !tokenSecret) {
  throw new Error("Missing MUX_TOKEN_ID / MUX_TOKEN_SECRET in .env");
}

export function createMuxClient() {
  return new Mux({ tokenId, tokenSecret });
}

// convenient singleton for most cases
export const mux = createMuxClient();
