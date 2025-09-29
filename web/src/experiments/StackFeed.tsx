import * as React from "react";
import Player from "@/components/Player";
import { usePlayback } from "@/context/PlaybackContext";
import { fetchFeed, getPlayUrl, type FeedItem, getSignedPosterUrl, playbackIdFromUrl } from "@/hooks/useFeed";

type State = 'poster' | 'preloading' | 'ready' | 'playing' | 'cooldown';

export default function StackFeed() {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [posters, setPosters] = React.useState<Record<string, string>>({});
  const [states, setStates] = React.useState<Record<string, State>>({});
  const [visible, setVisible] = React.useState<Record<string, number>>({});
  const [activeIdx, setActiveIdx] = React.useState(0);

  const { audioEnabled, mode } = usePlayback();

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const cardsRef = React.useRef<Record<string, HTMLElement | null>>({});

  React.useEffect(() => {
    let alive = true;
    fetchFeed().then(({ items }) => {
      if (!alive) return;
      setItems(items.slice(0, 10));
      const s: Record<string, State> = {};
      items.slice(0, 10).forEach(it => s[it.id] = 'poster');
      setStates(s);
    });
    return () => { alive = false; };
  }, []);

  // IntersectionObserver to track visibility
  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const thresholds = [0, 0.05, 0.2, 0.4, 0.6, 0.8, 1];
    const obs = new IntersectionObserver((entries) => {
      setVisible(v => {
        const next = { ...v } as Record<string, number>;
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.id!;
          next[id] = e.intersectionRatio;
        }
        // Update active index = max ratio
        let max = -1, idx = 0;
        items.forEach((it, i) => {
          const r = next[it.id] ?? 0;
          if (r > max) { max = r; idx = i; }
        });
        setActiveIdx(idx);
        return next;
      });
    }, { root, threshold: thresholds });
    items.forEach(it => {
      const el = cardsRef.current[it.id];
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items.length]);

  // Drive state transitions with simple rules and budgets
  React.useEffect(() => {
    if (items.length === 0) return;
    const maxSrc = 3;
    const maxPreload = 2;
    const newStates: Record<string, State> = { ...states };
    let srcCount = 0; let preloadCount = 0;
    const within = (i: number) => Math.abs(i - activeIdx) <= 1;

    // First, assign desired states
    items.forEach((it, i) => {
      const ratio = visible[it.id] ?? 0;
      if (ratio >= 0.6) {
        newStates[it.id] = 'playing';
      } else if (ratio >= 0.4) {
        // stay warmed if close
        newStates[it.id] = (newStates[it.id] === 'playing' || newStates[it.id] === 'ready' || newStates[it.id] === 'preloading') ? 'ready' : 'poster';
      } else if (within(i)) {
        // Preload window for N±1 depending on mode
        newStates[it.id] = (mode === 'instant' && i === activeIdx + 1) ? 'preloading' : 'poster';
      } else {
        newStates[it.id] = 'poster';
      }
    });

    // Enforce budgets
    items.forEach((it) => {
      const st = newStates[it.id];
      if (st === 'playing' || st === 'ready' || st === 'preloading') srcCount++;
      if (st === 'ready' || st === 'preloading') preloadCount++;
    });
    if (srcCount > maxSrc || preloadCount > maxPreload) {
      // Downgrade farthest warms to poster
      const candidates = items
        .map((it, i) => ({ it, i, dist: Math.abs(i - activeIdx) }))
        .filter(x => newStates[x.it.id] === 'ready' || newStates[x.it.id] === 'preloading')
        .sort((a, b) => b.dist - a.dist);
      for (const c of candidates) {
        if (srcCount <= maxSrc && preloadCount <= maxPreload) break;
        newStates[c.it.id] = 'poster';
        srcCount--; preloadCount--;
      }
    }

    setStates(newStates);
  }, [activeIdx, visible, items, mode]);

  // Prefetch play URLs and signed posters for active window (N-1, N, N+1)
  React.useEffect(() => {
    if (items.length === 0) return;
    const windowIdx = new Set([activeIdx - 1, activeIdx, activeIdx + 1].filter(i => i >= 0 && i < items.length));
    windowIdx.forEach(async (i) => {
      const it = items[i];
      if (!it) return;
      if (!urls[it.id]) {
        try {
          const u = await getPlayUrl(it.id);
          setUrls(m => ({ ...m, [it.id]: u }));
          // derive poster
          const pid = playbackIdFromUrl(u);
          if (pid && !posters[it.id]) {
            try {
              const h = Math.min(window.innerHeight || 900, 1280);
              const poster = await getSignedPosterUrl(pid, { height: h, format: 'jpg' });
              setPosters(m => ({ ...m, [it.id]: poster }));
              const img = new Image();
              (img as any).fetchPriority = 'high';
              img.decoding = 'async'; img.src = poster;
            } catch {}
          }
        } catch {}
      } else if (!posters[it.id]) {
        // We have URL; fetch poster now
        try {
          const pid = playbackIdFromUrl(urls[it.id]);
          if (pid) {
            const h = Math.min(window.innerHeight || 900, 1280);
            const poster = await getSignedPosterUrl(pid, { height: h, format: 'jpg' });
            setPosters(m => ({ ...m, [it.id]: poster }));
            const img = new Image();
            (img as any).fetchPriority = 'high';
            img.decoding = 'async'; img.src = poster;
          }
        } catch {}
      }
    });
  }, [items, activeIdx, urls, posters]);

  // Render list
  return (
    <div ref={containerRef} className="feed" style={{ paddingTop: 8 }}>
      {items.map((it, idx) => {
        const st = states[it.id] || 'poster';
        const src = urls[it.id];
        const isActive = idx === activeIdx;
        // Choose fit by aspect ratio vs 9:16 box
        const ar = it.aspectRatio ?? null;
        const boxAR = 9/16;
        const fit = ar && ar > boxAR ? 'contain' : 'cover';
        return (
          <section
            key={it.id}
            data-id={it.id}
            ref={el => { cardsRef.current[it.id] = el; }}
            className="card"
            style={{ background: '#000' }}
          >
            <div style={{ width: '100%', maxWidth: 460, margin: '0 auto', aspectRatio: '9 / 16', position: 'relative' }}>
              {/* Always render poster image layer to avoid black gaps during scroll */}
              {(() => {
                const posterUrl = posters[it.id];
                if (!posterUrl) return (
                  <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
                );
                return (
                  <img
                    src={posterUrl}
                    alt="poster"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, objectPosition: 'top center' }}
                  />
                );
              })()}

              {(st !== 'poster') && (
                <Player
                  src={src ?? undefined}
                  streamType="on-demand"
                  playsInline
                  muted={!audioEnabled || !isActive}
                  preload={st === 'preloading' ? (mode === 'instant' ? 'auto' : 'metadata') : 'metadata'}
                  autoPlay={isActive}
                  // Also set element poster for seamless handoff
                  {...(posters[it.id] ? { poster: posters[it.id] } : {})}
                  onLoadedMetadata={() => {
                    if (st === 'preloading') {
                      setStates(m => ({ ...m, [it.id]: 'ready' }));
                    }
                  }}
                  style={{ width: '100%', height: '100%', ['--media-object-fit' as any]: fit, ['--media-object-position' as any]: 'top center' }}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
