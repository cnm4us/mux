// web/src/hooks/useFeed.ts
export type FeedItem = {
  id: string;
  title?: string | null;
  playbackId?: string | null;
  durationSeconds?: number | null;
};

/**
 * Public (UNSIGNED) poster URL helper — only works if playbackId policy is "public".
 * For signed playback IDs this will 403. Prefer getSignedPosterUrl() when in doubt.
 */
export function getPosterUrl(item: FeedItem, h = 900) {
  if (!item.playbackId) return undefined;
  return `https://image.mux.com/${item.playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&height=${h}`;
}

/** Feed fetcher */
export async function fetchFeed(cursor?: string) {
  const q = new URLSearchParams({ limit: "8", ...(cursor ? { cursor } : {}) });
  const res = await fetch("/api/v1/feed?" + q.toString());
  if (!res.ok) throw new Error("feed failed");
  return res.json() as Promise<{ items: FeedItem[]; nextCursor?: string }>;
}

/** Signed PLAY url for a video id (your existing endpoint) */
export async function getPlayUrl(id: string) {
  const res = await fetch(`/api/v1/videos/${id}/play`);
  if (!res.ok) throw new Error("play failed");
  const data = await res.json();
  return data.playback?.url as string;
}

/** Extract playbackId from a Mux stream URL (https://stream.mux.com/<pid>.m3u8?...). */
export function playbackIdFromUrl(u: string): string | undefined {
  try {
    const url = new URL(u);
    if (!url.hostname.endsWith("stream.mux.com")) return;
    return url.pathname.replace(/^\//, "").split(".")[0] || undefined;
  } catch {
    return;
  }
}

/**
 * Public (UNSIGNED) poster builder by playbackId — will 403 for signed policy.
 * Keep around for any public assets you might have.
 */
export function posterFromPlaybackId(playbackId: string, h = 900) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&height=${h}`;
}

/**
 * SIGNED poster URL via your API:
 * GET /api/v1/assets/:playbackId/poster?time=1&height=900 → { url }
 * Works for signed playback IDs (adds token=JWT with aud "t").
 */
export async function getSignedPosterUrl(
  playbackId: string,
  opts?: { time?: number; height?: number; width?: number; fit_mode?: "smartcrop" | "pad" | "crop"; format?: "jpg" | "png" }
) {
  const q = new URLSearchParams({
    time: String(opts?.time ?? 1),
    height: String(opts?.height ?? 900),
    ...(opts?.width != null ? { width: String(opts.width) } : {}),
    ...(opts?.fit_mode ? { fit_mode: opts.fit_mode } : {}),
    ...(opts?.format ? { format: opts.format } : {}),
  });
  const res = await fetch(`/api/v1/assets/${playbackId}/poster?` + q.toString());
  if (!res.ok) throw new Error("poster failed");
  const data = await res.json();
  return data.url as string;
}
