import * as React from "react";
import Player from "@/components/Player";

type Props = {
  src: string | null;
  mode: "data-saver" | "instant";
  preload?: "none" | "metadata" | "auto";
  id?: string;
  onWarmed?: (id: string | undefined, src: string) => void;
};

/**
 * Hidden preloader that warms caches for the next item.
 * - Never calls play().
 * - metadata: fetch playlists + init segment (usually)
 * - auto: may fetch first media segment depending on UA/visibility
 */
export default function Preloader({ src, mode, preload = "metadata", id, onWarmed }: Props) {
  const [isWarmed, setIsWarmed] = React.useState(false);
  if (!src || mode !== "instant") return null;
  const onLM = () => {
    setIsWarmed(true);
    try { onWarmed?.(id, src); } catch {}
    // eslint-disable-next-line no-console
    console.log("[preloader] warmed", { id, src, preload });
  };
  return (
    <>
      {/* Keep the element technically on-screen to avoid iOS offscreen throttling */}
      <Player
        src={src}
        streamType="on-demand"
        muted
        preload={preload}
        playsInline
        onLoadedMetadata={onLM}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0.01,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {/* Tiny debug badge */}
      {isWarmed && (
        <div style={{ position: "fixed", top: 2, left: 6, fontSize: 10, color: "#9ae6b4", zIndex: 2 }}>
          warmed
        </div>
      )}
    </>
  );
}
