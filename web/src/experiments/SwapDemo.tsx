import * as React from "react";
import Player from "@/components/Player";
import Preloader from "@/experiments/components/Preloader";
import { fetchFeed, getPlayUrl, type FeedItem, playbackIdFromUrl, getSignedPosterUrl } from "@/hooks/useFeed";

type Mode = "data-saver" | "instant";

export default function SwapDemo() {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [active, setActive] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>("data-saver");
  const [preloadKind, setPreloadKind] = React.useState<"metadata"|"auto">("metadata");
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [posters, setPosters] = React.useState<Record<string, string>>({});
  const playerRef = React.useRef<React.ComponentRef<typeof Player> | null>(null);

  React.useEffect(() => {
    let on = true;
    fetchFeed().then(({ items }) => { if (on) setItems(items.slice(0, 6)); });
    return () => { on = false; };
  }, []);

  // Prefetch play URLs and posters for active + next
  React.useEffect(() => {
    const cur = items[active];
    const nxt = items[active + 1];
    [cur, nxt].forEach((it) => {
      if (!it || urls[it.id]) return;
      getPlayUrl(it.id).then(async (u) => {
        setUrls((m) => ({ ...m, [it.id]: u }));
        const pb = playbackIdFromUrl(u);
        if (!pb || posters[it.id]) return;
        try {
          const h = Math.min(window.innerHeight || 900, 1280);
          const poster = await getSignedPosterUrl(pb, { height: h, format: "jpg" });
          setPosters((m) => ({ ...m, [it.id]: poster }));
          // Warm the browser image cache
          const img = new Image();
          (img as any).fetchPriority = "high";
          img.decoding = "async"; img.src = poster;
        } catch {}
      }).catch(()=>{});
    });
  }, [active, items, urls, posters]);

  const cur = items[active];
  const nxt = items[active + 1];
  const curUrl = cur ? urls[cur.id] : null;
  const nextUrl = nxt ? urls[nxt.id] : null;
  const curPoster = cur ? posters[cur.id] : undefined;

  return (
    <div style={{ padding: 16 }}>
      <h2>Swap Demo</h2>
      <p style={{ opacity: 0.8 }}>Compare Data Saver (posters only) vs Instant (preload next).</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0 16px" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            checked={mode === "data-saver"}
            onChange={() => setMode("data-saver")}
          />
          Data Saver
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            checked={mode === "instant"}
            onChange={() => setMode("instant")}
          />
          Instant
        </label>
        {mode === "instant" && (
          <>
            <span style={{ marginLeft: 12 }}>preload:</span>
            <select value={preloadKind} onChange={(e) => setPreloadKind(e.target.value as any)}>
              <option value="metadata">metadata</option>
              <option value="auto">auto</option>
            </select>
          </>
        )}
        <span style={{ marginLeft: "auto", opacity: 0.7 }}>
          Items: {items.length} • Active: {active + 1}
        </span>
      </div>

      {/* Visible player */}
      <div style={{ maxWidth: 460, margin: "12px auto" }}>
        <div style={{ aspectRatio: "9 / 16", background: "#000", borderRadius: 8, overflow: "hidden" }}>
          <Player
            ref={playerRef as any}
            className="video-el"
            src={curUrl ?? undefined}
            playsInline
            autoPlay
            muted
            preload="metadata"
            style={{ width: "100%", height: "100%", display: "block" }}
            // Rely on element poster for the first paint
            {...(curPoster ? { poster: curPoster } : {})}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
        <button className="btn" disabled={active <= 0} onClick={() => setActive((i) => Math.max(0, i - 1))}>Prev</button>
        <button className="btn" disabled={active >= items.length - 1} onClick={() => setActive((i) => Math.min(items.length - 1, i + 1))}>Next</button>
      </div>

      {/* Hidden preloader for next item in Instant mode */}
      <Preloader src={nextUrl ?? null} mode={mode} preload={preloadKind} />

      <div style={{ marginTop: 24 }}>
        <h3>Notes</h3>
        <ul>
          <li>Data Saver: posters only, minimal bandwidth for skipped items.</li>
          <li>Instant: warms next item with metadata/auto preload for faster first frame.</li>
          <li>Preloader never calls play(); one user gesture elsewhere can unlock audio playback.</li>
        </ul>
      </div>
    </div>
  );
}

