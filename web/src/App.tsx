import { useEffect, useMemo, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "https://mux.bawebtech.com/api";

export default function App() {
    const [src, setSrc] = useState<string>();
    const pb = useMemo(() => new URLSearchParams(location.search).get("pb"), []);

    useEffect(() => {
        async function go() {
            // fallback to a known signed playback id if none provided
            const playbackId = pb || "HT00Up2yOOnx9P4X01ro3baO30289fvCp8ySbu1d102E2AA";
            const r = await fetch(`${API}/playback/${playbackId}/play`);
            const j = await r.json();
            setSrc(j?.playback?.url);
        }
        go();
    }, [pb]);

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
