import { mux } from "./index.js";

// Simple in-memory TTL cache for asset aspect ratios
const ASPECT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, { ar: number | null; exp: number }>();

function parseAspectString(s?: string | null): number | null {
  if (!s) return null;
  const m = String(s).match(/^(\d+)\s*:\s*(\d+)$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return null;
  return w / h;
}

export async function getAssetAspectRatio(assetId: string): Promise<number | null> {
  const now = Date.now();
  const hit = cache.get(assetId);
  if (hit && hit.exp > now) return hit.ar;

  try {
    const a: any = await mux.video.assets.retrieve(assetId);
    // Prefer aspect_ratio string if provided
    let ar = parseAspectString(a?.aspect_ratio);
    // Fallback: derive from track data or max dimensions
    if (!ar) {
      const w = a?.max_width || a?.tracks?.find((t: any) => t.type === "video")?.max_width;
      const h = a?.max_height || a?.tracks?.find((t: any) => t.type === "video")?.max_height;
      if (w && h) ar = Number(w) / Number(h);
    }
    cache.set(assetId, { ar, exp: now + ASPECT_TTL_MS });
    return ar ?? null;
  } catch {
    cache.set(assetId, { ar: null, exp: now + 30_000 });
    return null;
  }
}

