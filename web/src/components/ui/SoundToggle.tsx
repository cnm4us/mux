import { useEffect, useState } from "react";

const KEY = "sound:on";
export default function SoundToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
    const [soundOn, setSoundOn] = useState<boolean>(() => {
        try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
    });
    useEffect(() => { try { localStorage.setItem(KEY, soundOn ? "1" : "0"); } catch { } }, [soundOn]);
    return (
        <button
            className={`btn ${compact ? "btn-compact" : ""} ${className}`}
            onClick={() => setSoundOn(!soundOn)}
            aria-pressed={soundOn}
            title={soundOn ? "Sound on" : "Muted"}
        >
            {soundOn ? "🔊" : "🔇"} {!compact && (soundOn ? " Sound On" : " Muted")}
        </button>
    );
}
