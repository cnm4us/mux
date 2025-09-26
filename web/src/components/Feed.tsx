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

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const playerRef = React.useRef<React.ComponentRef<typeof MuxPlayer> | null>(null);

    const { soundOn, setSoundOn } = useSoundPref();

    // EFFECT 1: load initial feed
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

    // EFFECT 2: prefetch play URLs (active + next)
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

    // EFFECT 3: infinite pagination
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

    // EFFECT 4: observe which card is active
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

    // EFFECT 5: track player creation/reuse/unmount
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

    // EFFECT 6: swap src & play on active change
    React.useEffect(() => {
        const el = playerRef.current as any;
        const item = items[active];
        const url = urls[item?.id ?? ""];
        if (!el || !item || !url) return;

        const wantMuted = !soundOn;
        const waitFor = (evt: string) =>
            new Promise<void>((res) => {
                const on = () => { el.removeEventListener(evt, on as any); res(); };
                el.addEventListener(evt, on as any, { once: true });
            });

        const run = async () => {
            const id = el.__muxId ?? "?";
            dbg(`player #${id} swap -> idx ${active} (${item.id}), url:${tail(url)}, wantMuted:${wantMuted}`);
            try { await el.pause?.(); } catch { }

            if (el.src !== url) {
                el.src = url;
                dbg(`player #${id} src set`);
            }

            el.muted = wantMuted;

            dbg(`player #${id} waiting playbackready…`);
            await waitFor("playbackready");
            dbg(`player #${id} playbackready`);

            try {
                dbg(`player #${id} play() attempt (muted:${el.muted})`);
                await el.play();
                dbg(`player #${id} play() OK`);
            } catch (err) {
                dbg(`player #${id} play() FAILED (muted:${el.muted})`, err);
                if (!wantMuted) {
                    await new Promise(r => setTimeout(r, 50));
                    try {
                        dbg(`player #${id} retry play() (muted:${el.muted})`);
                        await el.play();
                        dbg(`player #${id} retry OK`);
                        return;
                    } catch (err2) {
                        dbg(`player #${id} retry FAILED`, err2);
                    }
                }
                el.muted = true;
                try {
                    dbg(`player #${id} fallback: muted=true; play()`);
                    await el.play();
                    dbg(`player #${id} fallback OK`);
                } catch (err3) {
                    dbg(`player #${id} fallback FAILED`, err3);
                }
            }
        };
        void run();
    }, [active, items, urls, soundOn]);

    const handleVideoTap = () => {
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

    return (
        <div ref={containerRef} className="feed">
            <div
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("mux-player")) handleVideoTap();
                }}
                style={{
                    position: "sticky",
                    top: 0,
                    height: "100vh",
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
                    style={{ width: "100%", height: "100%" }}
                />
            </div>

            {items.map((it, i) => (
                <section className="card" key={it.id} data-idx={i}>
                    <MuxPlayerCard
                        active={i === active}
                        title={it.title || "Untitled"}
                        index={i + 1}
                        total={items.length}
                        soundOn={soundOn}
                        onTapSound={handleVideoTap}
                    />
                </section>
            ))}

            {items.length === 0 && (
                <section className="card"><div>Loading feed…</div></section>
            )}
        </div>
    );
}
