// web/src/components/Feed.tsx
import * as React from "react";
import MuxPlayer from "@mux/mux-player-react";
import Player from "@/components/Player";
import { fetchFeed, getPlayUrl, type FeedItem, getPosterUrl } from "../hooks/useFeed";
import MuxPlayerCard from "./MuxPlayerCard";
import { useSoundPref } from "@/hooks/useSoundPref";

let __PLAYER_SEQ = 0;
function dbg(...args: any[]) { /* unchanged */ }
function tail(u: string) { /* unchanged */ }

export default function Feed() {
    const [items, setItems] = React.useState<FeedItem[]>([]);
    const [cursor, setCursor] = React.useState<string | undefined>();
    const [active, setActive] = React.useState(0);
    const [urls, setUrls] = React.useState<Record<string, string>>({});
    const [posters, setPosters] = React.useState<Record<string, string>>({});
    const [paused, setPaused] = React.useState<Record<string, boolean>>({});
    const [needsGesture, setNeedsGesture] = React.useState(false);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const playerRef = React.useRef<React.ComponentRef<typeof MuxPlayer> | null>(null);

    const { soundOn, setSoundOn } = useSoundPref();

    // EFFECT 1: load initial feed (unchanged)
    React.useEffect(() => { /* unchanged */ }, []);

    // EFFECT 2: prefetch play URLs (active + next)  (unchanged)
    React.useEffect(() => { /* unchanged */ }, [active, items, urls]);

    // NEW: prefetch posters (active + next)
    React.useEffect(() => {
        const ids = [items[active], items[active + 1]].filter(Boolean) as FeedItem[];
        ids.forEach((it) => {
            if (posters[it.id]) return;
            const p = getPosterUrl(it);
            if (!p) return;
            setPosters((m) => ({ ...m, [it.id]: p }));
            const img = new Image();
            img.decoding = "async";
            img.src = p;
        });
    }, [active, items, posters]);

    // EFFECT 3: infinite pagination (unchanged)
    React.useEffect(() => { /* unchanged */ }, [active, cursor, items.length]);

    // EFFECT 4: observe which card is active (unchanged)
    React.useEffect(() => { /* unchanged */ }, [items.length]);

    // EFFECT 5: track player creation/reuse (unchanged)
    React.useEffect(() => { /* unchanged */ }, []);

    // EFFECT 6: swap src & play on active change (with gesture & pause-per-card)
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
            const poster = posters[item.id];
            try { await el.pause?.(); } catch { }

            // Set poster first to avoid black flash
            if (poster && el.poster !== poster) {
                el.poster = poster;
            }

            if (el.src !== url) {
                el.src = url;
            }

            el.muted = wantMuted;

            // Wait for readiness
            await Promise.race([waitFor("playbackready"), waitFor("loadedmetadata")]);

            // Respect manual pause on this card: don't auto-play if user paused it
            if (isPausedByUser) {
                dbg(`player #${id} respecting pausedByUser on ${item.id}`);
                return;
            }

            try {
                setNeedsGesture(false);
                await el.play();
                return;
            } catch { }

            if (!wantMuted) {
                try {
                    await new Promise((r) => setTimeout(r, 60));
                    await el.play();
                    return;
                } catch { }
            }

            // Fallback: require a gesture
            setNeedsGesture(true);
            await waitForUserGesture();
            setNeedsGesture(false);
            el.muted = true;
            try { await el.play(); } catch { }
        };

        void run();
    }, [active, items, urls, soundOn, paused, posters]);

    // Toggle pause for current card only
    const togglePauseActive = async () => {
        const el = playerRef.current as any;
        const item = items[active];
        if (!el || !item) return;

        if (el.paused) {
            setPaused((m) => ({ ...m, [item.id]: false }));
            try { await el.play(); } catch { }
        } else {
            setPaused((m) => ({ ...m, [item.id]: true }));
            try { await el.pause(); } catch { }
        }
    };

    // Tap on video:
    // - If we still need a gesture: start playback
    // - Else: toggle pause for this card (sound remains handled by the overlay button)
    const handleVideoAreaClick = () => {
        if (needsGesture) {
            setNeedsGesture(false);
            const el = playerRef.current as any;
            el?.play?.().catch(() => { });
        } else {
            togglePauseActive();
        }
    };

    // Keep global “tap for sound” overlay
    const handleTapForSound = () => {
        const el = playerRef.current as any;
        setSoundOn(true);
        if (el) {
            el.muted = false;
            el.play?.().catch(() => { });
        }
    };

    // Basic layout constants
    const NAV_H = 64; // adjust to your real bottom-nav height in px

    return (
        <div
            ref={containerRef}
            className="feed"
            style={{
                // leave room for the fixed bottom nav
                paddingBottom: `calc(${NAV_H}px + env(safe-area-inset-bottom, 0px))`,
                scrollSnapType: "y mandatory",
                overflowY: "auto"
            }}
        >
            {/* Sticky player occupies full viewport, not under nav */}
            <div
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest("mux-player")) return;
                    handleVideoAreaClick();
                }}
                style={{
                    position: "sticky",
                    top: 0,
                    height: "100dvh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    zIndex: 1
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
                    // poster is set dynamically before src swap; keep size full
                    style={{ width: "100%", height: "100%" }}
                />
            </div>

            {/* Cards: supply poster to show behind sticky player during scroll */}
            {items.map((it, i) => (
                <section
                    className="card"
                    key={it.id}
                    data-idx={i}
                    style={{
                        position: "relative",
                        minHeight: "100dvh",
                        scrollSnapAlign: "start",
                        background: posters[it.id]
                            ? `center / cover no-repeat url("${posters[it.id]}")`
                            : "black"
                    }}
                >
                    <MuxPlayerCard
                        active={i === active}
                        title={it.title || "Untitled"}
                        index={i + 1}
                        total={items.length}
                        soundOn={soundOn}
                        onTapSound={handleTapForSound}
                        needsGesture={needsGesture && i === active}
                    />
                </section>
            ))}

            {items.length === 0 && <section className="card"><div>Loading feed…</div></section>}
        </div>
    );
}
