// Feed.tsx
import * as React from "react";
// Register Media Chrome custom elements (media-controller, media-progress-range)
import 'media-chrome';
import MuxPlayer from "@mux/mux-player-react";
import Player from "@/components/Player";
import { fetchFeed, getPlayUrl, type FeedItem, playbackIdFromUrl, getSignedPosterUrl } from "../hooks/useFeed";
import MuxPlayerCard from "./MuxPlayerCard";
import { useSoundPref } from "@/hooks/useSoundPref";

let __PLAYER_SEQ = 0;

function logToServer(event: string, data: any) {
    try {
        // redact Mux tokens in querystrings
        if (data?.url) {
            data.url = String(data.url).replace(/([?&]token=)[^&]+/i, "$1[redacted]");
        }
        fetch("/api/v1/_log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, ts: Date.now(), ...data }),
        }).catch(() => { });
    } catch { }
}

function dbg(...args: any[]) {
    // @ts-ignore
    if (typeof window !== "undefined" && !window.__MUX_DEBUG) return;
    // eslint-disable-next-line no-console
    console.log("[mux-feed]", ...args);
}
function tail(u: string) {
    try { const q = new URL(u); return q.pathname.split("/").pop(); } catch { return u.slice(-30); }
}

export default function Feed() {
    const [items, setItems] = React.useState<FeedItem[]>([]);
    const [cursor, setCursor] = React.useState<string | undefined>();
    const [active, setActive] = React.useState(0);
    const [urls, setUrls] = React.useState<Record<string, string>>({});
    const [posters, setPosters] = React.useState<Record<string, string>>({});
    // Track only if the user explicitly paused; autoplay transitions shouldn't show play icon
    const [userPaused, setUserPaused] = React.useState(false);
    // No per-item paused map; pause applies to the sticky player only
    // and scrolling resumes autoplay with sound.
    const [hasUserGesture, setHasUserGesture] = React.useState(false);
    const [hasStarted, setHasStarted] = React.useState(false);
    // First-card poster gating: wait for media + stable container
    const [firstMediaReady, setFirstMediaReady] = React.useState(false);
    const [containerStable, setContainerStable] = React.useState(false);
    const [firstPosterShown, setFirstPosterShown] = React.useState(false);
    const [firstPrimed, setFirstPrimed] = React.useState(false);
    // Minimal progress indicator state
    const [duration, setDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [bufferedEnd, setBufferedEnd] = React.useState(0);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const playerContainerRef = React.useRef<HTMLDivElement | null>(null);
    const playerRef = React.useRef<React.ComponentRef<typeof MuxPlayer> | null>(null);

    const { soundOn, setSoundOn } = useSoundPref();

    // Initialize session-based resume: if this tab session has already started
    React.useEffect(() => {
        try {
            if (sessionStorage.getItem('session:started') === '1') {
                setHasUserGesture(true);
            }
        } catch {}
    }, []);

    // No external start event; first user tap sets gesture.

    /* EFFECT: when poster for the active item becomes available, ensure player.poster is set (never for first tile) */
    React.useEffect(() => {
        const el = playerRef.current as any;
        const item = items[active];
        if (!el || !item) return;
        if (active === 0) return; // never set poster on the first tile
        const posterUrl = posters[item.id];
        const isFirst = active === 0;
        const allowPoster = isFirst ? false : hasStarted;
        if (allowPoster && posterUrl && el.poster !== posterUrl) {
            try {
                dbg("player poster late-set:", item.id, tail(posterUrl));
                el.poster = posterUrl;
            } catch {}
        }
    }, [active, items, posters, hasStarted, firstMediaReady, containerStable, firstPosterShown]);

    // Mark container stable for first card using ResizeObserver debounce
    React.useEffect(() => {
        const box = playerContainerRef.current;
        if (!box) return;
        // Only care about the first card
        if (active !== 0) return;
        let to: any;
        const ro = new ResizeObserver(() => {
            setContainerStable(false);
            clearTimeout(to);
            to = setTimeout(() => setContainerStable(true), 200);
        });
        try { ro.observe(box); } catch {}
        // Kick off an initial settle timer
        to = setTimeout(() => setContainerStable(true), 200);
        return () => { clearTimeout(to); try { ro.disconnect(); } catch {} };
    }, [active]);

    // Once allowed, remember that the first poster has been shown so we don't flicker it off
    React.useEffect(() => {
        if (active !== 0) return;
        if (firstPosterShown) return;
        if (firstMediaReady && containerStable) setFirstPosterShown(true);
    }, [active, firstMediaReady, containerStable, firstPosterShown]);

    // Muted prime for the first tile only: paint an initial frame without user gesture
    React.useEffect(() => {
        if (active !== 0) return;
        if (firstPrimed) return;
        // Proceed once media is ready; do not require containerStable to avoid iOS dvh toolbar churn
        if (!firstMediaReady) return;
        // If the session already has a user gesture, skip priming to allow autoplay with sound
        if (hasUserGesture) return;
        const el = playerRef.current as any;
        if (!el) return;
        let cancelled = false;
        const waitForOnce = (evt: string) =>
            new Promise<void>((res) => {
                const on = () => { el.removeEventListener(evt, on as any); res(); };
                el.addEventListener(evt, on as any, { once: true });
            });
        (async () => {
            try {
                el.muted = true;
                const playP = el.play?.();
                if (playP && typeof playP.then === 'function') {
                    // Wait for a frame to be decodable/paintable; allow a longer window on iOS/HLS
                    await Promise.race([
                        waitForOnce('loadeddata'),
                        waitForOnce('canplay'),
                        waitForOnce('playing'),
                        new Promise<void>((r) => setTimeout(r, 1200)),
                    ]);
                } else {
                    await new Promise<void>((r) => setTimeout(r, 400));
                }
            } catch {}
            finally {
                try { await el.pause?.(); } catch {}
                try { el.muted = false; } catch {}
                if (!cancelled) setFirstPrimed(true);
            }
        })();
        return () => { cancelled = true; };
    }, [active, firstMediaReady, containerStable, firstPrimed, hasUserGesture]);

    /* EFFECT 1: load initial feed */
    React.useEffect(() => {
        let mounted = true;
        fetchFeed()
            .then(({ items, nextCursor }) => {
                if (!mounted) return;
                setItems(items);
                setCursor(nextCursor);
                dbg("feed loaded:", items.length, "items");
            })
            .catch((e) => dbg("feed load error", e));
        return () => { mounted = false; };
    }, []);

    /* EFFECT 2: prefetch play URLs (active + next) */
    React.useEffect(() => {
        const cur = items[active];
        const nxt = items[active + 1];
        [cur, nxt].forEach((it) => {
            if (!it || urls[it.id]) return;
            getPlayUrl(it.id)
                .then(async (u) => {
                    setUrls((m) => ({ ...m, [it.id]: u }));
                    dbg("prefetched url:", it.id, tail(u));

                    // Derive poster from the playback URL if feed lacks playbackId
                    if (!posters[it.id]) {
                        const pid = playbackIdFromUrl(u);
                        if (!pid) {
                            dbg("no playbackId derivable from url for", it.id);
                            return;
                        }
                        try {
                            // Compute portrait 9:16 crop sized to viewport height (cap to keep it light)
                            const vh = Math.min(window.innerHeight || 900, 1280);
                            const isPortrait = (window.innerHeight || 1) >= (window.innerWidth || 1);
                            const height = isPortrait ? vh : Math.round((window.innerWidth || 540) * 9 / 16);
                            const width = isPortrait ? Math.round(height * 9 / 16) : (window.innerWidth || 540);
                            const p = await getSignedPosterUrl(pid, { height, width });


                            logToServer("poster.signed.received", { itemId: it.id, pid, url: p });
                            const img = new Image();
                            img.decoding = "async";
                            img.onload = () => dbg("poster (signed) ok:", it.id, tail(p));
                            img.onerror = (e) => dbg("poster (signed) FAILED:", it.id, p, e);
                            img.src = p;
                            setPosters((m) => ({ ...m, [it.id]: p }));
                            logToServer("poster.prefetch.started", { itemId: it.id, url: p });
                            dbg("poster (signed) scheduled:", it.id, tail(p));
                        } catch (e) {
                            dbg("poster signing failed:", it.id, e);
                        }
                    }

                })
                .catch(() => { });
        });
    }, [active, items, urls, posters]);



    /* EFFECT 3: infinite pagination */
    React.useEffect(() => {
        if (items.length === 0 || !cursor) return;
        if (active < items.length - 2) return;
        let mounted = true;
        fetchFeed(cursor)
            .then(({ items: more, nextCursor }) => {
                if (!mounted) return;
                setItems((prev) => [...prev, ...more]);
                setCursor(nextCursor);
                dbg("feed appended:", more.length, "more (total", items.length + more.length, ")");
            })
            .catch((e) => dbg("feed append error", e));
        return () => { mounted = false; };
    }, [active, cursor, items.length]);

    /* EFFECT 4: observe which card is active */
    React.useEffect(() => {
        const root = containerRef.current;
        if (!root) return;
        const cards = Array.from(root.querySelectorAll("[data-idx]")) as HTMLElement[];
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        const idx = Number((e.target as HTMLElement).dataset.idx);
                        if (!Number.isNaN(idx)) {
                            dbg("active ->", idx);
                            setActive(idx);
                        }
                    }
                });
            },
            { root, threshold: 0.6 }
        );
        cards.forEach((c) => obs.observe(c));
        return () => obs.disconnect();
    }, [items.length]);

    /* EFFECT 5: track player creation/reuse/unmount (should be once) */
    React.useEffect(() => {
        const el = playerRef.current as any;
        if (!el) return;

        const handler = (evt: Event) => {
            logToServer("player.media.event", {
                type: evt.type,
                currentSrc: el.currentSrc || null,
                readyState: el.readyState,
                paused: el.paused,
            });
            if ((evt as any).type === 'playing') {
                try { setHasStarted(true); } catch {}
                try { setUserPaused(false); } catch {}
            }
            if ((evt as any).type === 'loadedmetadata' || (evt as any).type === 'playbackready') {
                if (active === 0) {
                    try { setFirstMediaReady(true); } catch {}
                }
            }
            // Update progress metrics
            try {
                if ((evt as any).type === 'loadedmetadata' || (evt as any).type === 'durationchange') {
                    setDuration(Number.isFinite(el.duration) ? el.duration : 0);
                }
                if ((evt as any).type === 'timeupdate' || (evt as any).type === 'playing') {
                    setCurrentTime(Number.isFinite(el.currentTime) ? el.currentTime : 0);
                }
                if ((evt as any).type === 'progress' || (evt as any).type === 'loadedmetadata' || (evt as any).type === 'playing') {
                    const br: TimeRanges = el.buffered;
                    let end = 0;
                    try {
                        const t = el.currentTime || 0;
                        for (let i = 0; i < br.length; i++) {
                            const s = br.start(i), e = br.end(i);
                            if (t >= s && t <= e) { end = e; break; }
                            end = Math.max(end, e);
                        }
                    } catch {}
                    setBufferedEnd(Number.isFinite(end) ? end : 0);
                }
            } catch {}
        };
        ["loadstart", "loadedmetadata", "durationchange", "timeupdate", "progress", "waiting", "stalled", "playing", "pause", "ended", "error"].forEach(t =>
            el.addEventListener(t, handler)
        );


        if (!el.__muxId) {
            el.__muxId = ++__PLAYER_SEQ;
            dbg(`player #${el.__muxId} CREATED`);
        } else {
            dbg(`player #${el.__muxId} REUSED`);
        }
        return () => {
            ["loadstart", "loadedmetadata", "waiting", "stalled", "playing", "pause", "ended", "error"].forEach(t =>
                el.removeEventListener(t, handler)
            );
            dbg(`player #${el?.__muxId ?? "?"} UNMOUNTED`);
        };
    }, []);

    /* EFFECT 6: swap src & play on active change */
    React.useEffect(() => {
        const el = playerRef.current as any;
        const item = items[active];
        const url = urls[item?.id ?? ""];
        if (!el || !item || !url) return;

        const posterUrl = posters[item.id];

        const waitFor = (evt: string) =>
            new Promise<void>((res) => {
                const on = () => { el.removeEventListener(evt, on as any); res(); };
                el.addEventListener(evt, on as any, { once: true });
            });

        const run = async () => {
            const id = el.__muxId ?? "?";
            dbg(`player #${id} swap -> idx ${active} (${item.id}), url:${tail(url)}`);
            const isFirst = active === 0;
            const allowPoster = isFirst ? false : hasStarted;

            // Only pause/swap when changing items
            if (el.src !== url) {
                try { await el.pause?.(); } catch { }
                // Set poster first to avoid black frame while the new src spins up
                if (allowPoster && posterUrl && el.poster !== posterUrl) {
                    dbg("player poster set:", items[active].id, tail(posterUrl));
                    el.poster = posterUrl;
                    logToServer("player.poster.set", { itemId: items[active].id, url: posterUrl });
                } else {
                    dbg("player poster unchanged or missing:", items[active].id, tail(posterUrl || "none"));
                }
                // Reset progress metrics for the new source
                try { setDuration(0); setCurrentTime(0); setBufferedEnd(0); } catch {}
                el.src = url;
                dbg(`player #${id} src set`);
                logToServer("player.src.set", { itemId: items[active].id, url });
            }

            // We'll enforce unmuted just before play when allowed

            dbg(`player #${id} waiting ready…`);
            await Promise.race([waitFor("playbackready"), waitFor("loadedmetadata")]);
            dbg(`player #${id} ready`);

            // Autoplay with sound after the user has provided a gesture
            if (hasUserGesture) {
                // Consider scroll as resume: hide HUD immediately
                try { setUserPaused(false); } catch {}
                try {
                    el.muted = false;
                    await el.play();
                    dbg(`player #${id} autoplay with sound OK`);
                } catch (err) {
                    dbg(`player #${id} autoplay failed`, err);
                    try { setUserPaused(true); } catch {}
                }
            } else {
                dbg(`player #${id} holding (no gesture yet)`);
            }
        };

        void run();
    }, [active, items, urls, hasUserGesture, posters]);

    // Toggle pause/play on overlay tap (after first gesture)
    const togglePauseActive = async () => {
        const el = playerRef.current as any;
        if (!el) return;
        try {
            if (el.paused) {
                el.muted = false;
                await el.play();
                setUserPaused(false);
            } else {
                await el.pause();
                setUserPaused(true);
            }
        } catch {}
    };

    return (
        <div ref={containerRef} className="feed">
            {/* Sticky player */}
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    height: "100dvh",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    zIndex: 1,
                }}
                ref={playerContainerRef}
            >
                {/* Media controller wraps the player and enables scrubbable progress */}
                <media-controller id="mux-ctrl" style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <Player
                        ref={playerRef}
                        slot="media"
                        className="video-el"
                        streamType="on-demand"
                        preload={active === 0 ? "auto" : "metadata"}
                        autoPlay={false}
                        muted={false}
                        playsInline
                        nohotkeys
                        poster={active === 0 ? undefined : (hasStarted ? (posters[items[active]?.id || ""] || undefined) : undefined)}
                        /* Disable pointer to avoid fighting built-in center play button */
                        style={{
                            width: "100%",
                            // keep intrinsic video size, avoid stretching poster
                            aspectRatio: "9 / 16",
                            maxHeight: "100dvh",
                            pointerEvents: "none",
                            backgroundColor: "#000"
                        }}
                    />

                    {/* (Progress moved outside controller to sit above overlay) */}
                </media-controller>

                {/* Full-screen invisible hit area over the player (click + keyboard) */}
                <div
                    role="button"
                    tabIndex={0}
                    aria-label="Play or pause"
                    aria-pressed={userPaused}
                    onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            togglePauseActive();
                        }
                    }}
                    onClick={async () => {
                        const el = playerRef.current as any;
                        if (!el) return;
                        // First ever tap: enable sound and start playback with audio
                        if (!hasUserGesture) {
                            setHasUserGesture(true);
                            try { sessionStorage.setItem('session:started', '1'); } catch {}
                            try {
                                el.muted = false;
                                await el.play();
                                setUserPaused(false);
                            } catch {
                                // Fallback: try muted once, then user can tap again
                                try { el.muted = true; await el.play(); } catch { }
                            }
                            return;
                        }
                        // Subsequent taps: toggle pause/play for the active item
                        void togglePauseActive();
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 3,              // below our small overlay buttons, above player
                        background: "transparent",
                        cursor: "pointer",
                        outline: "none",
                    }}
                />

                {/* HUD: big translucent play icon only (non-interactive) */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 4,
                        pointerEvents: "none",
                    }}
                >
                    {(() => {
                        const showPlay = (!hasUserGesture) || userPaused;
                        return showPlay ? (
                            <div className={`hud-indicator is-paused`} aria-hidden="true">▶</div>
                        ) : null;
                    })()}
                </div>

                {/* Scrubbable progress bar (interactive) */}
                {/* Scrubbable time range outside controller so it sits above overlay; bind via mediacontroller */}
                <media-time-range
                    aria-label="Seek"
                    mediacontroller="mux-ctrl"
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: `calc(56px + env(safe-area-inset-bottom) + 0px)`,
                        zIndex: 10,
                        pointerEvents: 'auto',
                        height: 28,
                        marginLeft: 12,
                        marginRight: 12,
                        width: 'auto'
                    }}
                />
            </div>

            {/* Cards: overlays + counters; player itself is sticky above */}
            {items.map((it, i) => {
                const isActive = i === active;
                return (
                    <section
                        className="card"
                        key={it.id}
                        data-idx={i}
                        style={{ background: "#000" }}
                    >
                        <MuxPlayerCard
                            active={isActive}
                            title={it.title || "Untitled"}
                            index={i + 1}
                            total={items.length}
                        />
                    </section>
                );
            })}

            {items.length === 0 && (
                
                <section className="card"><div>Loading feed…</div></section>
                
            )}
        </div>
    );
}
