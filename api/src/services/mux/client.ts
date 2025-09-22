import Mux from "@mux/mux-node";
import { config } from "../../config/index.js";


export function createMuxClient() {
return new Mux({ tokenId: config.MUX_TOKEN_ID, tokenSecret: config.MUX_TOKEN_SECRET });
}