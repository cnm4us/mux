// Feed.tsx
import * as React from "react";
import MuxPlayer from "@mux/mux-player-react";
import Player from "@/components/Player";
import { fetchFeed, getPlayUrl, type FeedItem } from "../hooks/useFeed";
import MuxPlayerCard from "./MuxPlayerCard";
import { useSoundPref } from "@/hooks/useSoundPref";

let __PLAYER_SEQ = 0;
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
    const [paused, setPaused] = React.useState<Record<string, boolean>>({});
    const [needsGesture, setNeedsGesture] = React.useState(false);
    const [hasUserGesture, setHasUserGesture] = React.useState(false);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const playerRef = React.useRef<React.ComponentRef<typeof MuxPlayer> | null>(null);

    const { soundOn, setSoundOn } = useSoundPref();

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
                .then((u) => {
                    setUrls((m) => ({ ...m, [it.id]: u }));
                    dbg("prefetched url:", it.id, tail(u));
                })
                .catch(() => { });
        });
    }, [active, items, urls]);

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

        if (!el.__muxId) {
            el.__muxId = ++__PLAYER_SEQ;
            dbg(`player #${el.__muxId} CREATED`);
        } else {
            dbg(`player #${el.__muxId} REUSED`);
        }
        return () => { dbg(`player #${el?.__muxId ?? "?"} UNMOUNTED`); };
    }, []);

    /* EFFECT 6: swap src & play on active change (respect per-card pause) */
    React.useEffect(() => {
        const el = playerRef.current as any;
        const item = items[active];
        const url = urls[item?.id ?? ""];
        if (!el || !item || !url) return;

        const wantMuted = !soundOn;
        const isPausedByUser = !!paused[item.id];

        const waitFor = (evt: string) =>
            new Promise<void>((res) => {
                const on = () => { el.removeEventListener(evt, on as any); res(); };
                el.addEventListener(evt, on as any, { once: true });
            });

        const waitForUserGesture = () =>
            new Promise<void>((res) => {
                const handler = () => { cleanup(); res(); };
                const cleanup = () => {
                    window.removeEventListener("pointerdown", handler, true);
                    window.removeEventListener("touchstart", handler, true);
                    window.removeEventListener("click", handler, true);
                };
                window.addEventListener("pointerdown", handler, true);
                window.addEventListener("touchstart", handler, true);
                window.addEventListener("click", handler, true);
            });

        const run = async () => {
            const id = el.__muxId ?? "?";
            dbg(`player #${id} swap -> idx ${active} (${item.id}), url:${tail(url)}, wantMuted:${wantMuted}`);


            if (el.src !== url) {
                try { await el.pause?.(); } catch { }
                el.src = url;
                dbg(`player #${id} src set`);
            }

            el.muted = wantMuted;

            dbg(`player #${id} waiting ready…`);
            await Promise.race([waitFor("playbackready"), waitFor("loadedmetadata")]);
            dbg(`player #${id} ready`);

            // If user paused this specific card, don't auto-play it.
            if (isPausedByUser) {
                dbg(`player #${id} respecting pausedByUser on ${item.id}`);
                return;
            }

            try {
                setNeedsGesture(false);
                dbg(`player #${id} play() attempt (muted:${el.muted})`);
                await el.play();
                dbg(`player #${id} play() OK`);
                return;
            } catch (err) {
                dbg(`player #${id} play() FAILED first`, err);
            }

            if (!wantMuted) {
                try {
                    await new Promise(r => setTimeout(r, 60));
                    dbg(`player #${id} retry play() (muted:${el.muted})`);
                    await el.play();
                    dbg(`player #${id} retry OK`);
                    return;
                } catch (err2) {
                    dbg(`player #${id} retry FAILED`, err2);
                }
            }

            // iOS wants a gesture — arm one-shot listener and show overlay
            setNeedsGesture(true);
            dbg(`player #${id} awaiting user gesture to start…`);
            await waitForUserGesture();
            setNeedsGesture(false);

            el.muted = true; // start muted to satisfy policy; Sound flow can unmute later
            try {
                dbg(`player #${id} gesture play()`);
                await el.play();
                dbg(`player #${id} gesture play OK`);
            } catch (e3) {
                dbg(`player #${id} gesture play FAILED`, e3);
            }
        };

        void run();
    }, [active, items, urls, soundOn]);

    /* Tap to enable sound (after playback is running) */
    const handleVideoTapForSound = () => {
        const el = playerRef.current as any;
        setSoundOn(true);
        dbg(`gesture: enable sound → player #${el?.__muxId ?? "?"}`);
        if (el) {
            el.muted = false;
            el.play?.()
                .then(() => dbg(`player #${el.__muxId} play() after tap OK`))
                .catch((e: any) => dbg(`player #${el.__muxId} play() after tap FAILED`, e));
        }
    };

    /* Tap to toggle pause ONLY for the current card */
    const togglePauseActive = async () => {
        const el = playerRef.current as any;
        const item = items[active];
        if (!el || !item) return;
        if (el.paused) {
            try {
                await el.play();            // try with current mute state
                setPaused((m) => ({ ...m, [item.id]: false }));
                return;
            } catch {
                try {
                    el.muted = true;          // policy-safe fallback
                    await el.play();
                    setPaused((m) => ({ ...m, [item.id]: false }));
                    return;
                } catch {
                    setNeedsGesture(true);    // next tap will satisfy
                    return;
                }
            }
        } else {
            setPaused((m) => ({ ...m, [item.id]: true }));
            try { await el.pause(); } catch { }
        }
    };

    return (
        <div ref={containerRef} className="feed">
            {/* Sticky player */}
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    zIndex: 1,
                }}
            >
                <Player
                    ref={playerRef}
                    className="video-el"
                    streamType="on-demand"
                    preload="metadata"
                    autoPlay
                    muted={!soundOn}
                    playsInline
                    nohotkeys
                    /* Disable pointer to avoid fighting built-in center play button */
                    style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                />

                {/* Full-screen invisible hit area over the player (click + keyboard) */}
                <div
                    role="button"
                    tabIndex={0}
                    aria-label="Play or pause"
                    aria-pressed={!!paused[items[active]?.id]}
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
                            setNeedsGesture(false);
                            setSoundOn(true);
                            try {
                                el.muted = false;
                                await el.play();
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

                {/* HUD: big translucent play/pause icon (non-interactive) */}
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
                        const curId = items[active]?.id;
                        const showPaused = !hasUserGesture || !!paused[curId];
                        return (
                            <div
                                className={`hud-indicator ${showPaused ? "is-paused" : "is-playing"}`}
                                aria-hidden="true"
                            >
                                {showPaused ? "▶" : "⏸"}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Cards: overlays + counters; player itself is sticky above */}
            {items.map((it, i) => (
                <section className="card" key={it.id} data-idx={i}>
                    <MuxPlayerCard
                        active={i === active}
                        title={it.title || "Untitled"}
                        index={i + 1}
                        total={items.length}
                    />
                </section>
            ))}

            {items.length === 0 && (
                <section className="card"><div>Loading feed…</div></section>
            )}
        </div>
    );
}
