import { useEffect, useMemo, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import Uploader from "./components/Uploader";
import Feed from "./components/Feed";
import "./styles.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

export default function App() {
    const pb = useMemo(() => new URLSearchParams(location.search).get("pb"), []);
    const [src, setSrc] = useState<string | null>(null);

    // If a ?pb=<playbackId> is provided, show a simple single-player page
    useEffect(() => {
        if (!pb) return;
        (async () => {
            const r = await fetch(`${API}/playback/${pb}/play`);
            const j = await r.json();
            setSrc(j?.playback?.url ?? null);
        })();
    }, [pb]);

    if (pb) {
        // Single-player view (keeps your original behavior)
        if (!src) return <p style={{ padding: 16 }}>Loading…</p>;
        return (
            <div style={{ maxWidth: 420, margin: "40px auto" }}>
                <h1>Mux POC</h1>
                <small style={{ wordBreak: "break-all" }}>{src}</small>
                <MuxPlayer
                    src={src}
                    streamType="on-demand"
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", aspectRatio: "9 / 16", display: "block", marginTop: 12 }}
                />
            </div>
        );
    }

    // Default app: Uploader + Swipe Feed
    return (
        <div style={{ height: "100%" }}>
            <Uploader />
            <Feed />
        </div>
    );
}
