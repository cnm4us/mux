import { useEffect, useRef } from "react";
import type * as React from "react";
import MuxPlayer from "@mux/mux-player-react";

type MuxRef = React.ElementRef<typeof MuxPlayer>;

export default function MuxPlayerCard({ src, active }: { src?: string; active: boolean }) {
    const ref = useRef<MuxRef>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (active) el.play?.().catch?.(() => { });
        else el.pause?.();
    }, [active]);

    return (
        <MuxPlayer
            ref={ref}
            className="video-el"
            streamType="on-demand"
            preload="metadata"
            autoPlay={false}
            muted
            playsInline
            nohotkeys
            src={src || undefined}
        />
    );
}
