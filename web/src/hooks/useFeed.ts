export type FeedItem = { id: string; title?: string | null; playbackId?: string | null; durationSeconds?: number | null }


export async function fetchFeed(cursor?: string) {
    const q = new URLSearchParams({ limit: '8', ...(cursor ? { cursor } : {}) })
    const res = await fetch('/api/v1/feed?' + q.toString())
    if (!res.ok) throw new Error('feed failed')
    return res.json() as Promise<{ items: FeedItem[]; nextCursor?: string }>
}


export async function getPlayUrl(id: string) {
    const res = await fetch(`/api/v1/videos/${id}/play`)
    if (!res.ok) throw new Error('play failed')
    const data = await res.json()
    return data.playback?.url as string
}

export function getPosterUrl(item: FeedItem, h = 900) {
  if (!item.playbackId) return undefined;
  // Mux Image service: crop smartly; pick a vertical-friendly height
  return `https://image.mux.com/${item.playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&height=${h}`;
}