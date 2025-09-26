// MuxPlayerCard.tsx
export default function MuxPlayerCard({
    active, title, index, total, soundOn, onTapSound, needsGesture
}: {
    active: boolean;
    title: string;
    index: number;
    total: number;
    soundOn: boolean;
    onTapSound: () => void;
    needsGesture?: boolean;
}) {
    return (
        <>
            <div className="title">{title}</div>
            <div className="badge">{index} / {total}</div>

            {active && needsGesture && (
                <button
                    className="btn btn-compact"
                    style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 2 }}
                    // stops propagation so wrapper click doesn’t double-fire
                    onClick={(e) => e.stopPropagation()}
                >
                    ▶︎ Tap to play
                </button>
            )}

            {active && !soundOn && !needsGesture && (
                <button
                    className="btn btn-compact"
                    style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}
                    onClick={onTapSound}
                >
                    🔇 Tap for sound
                </button>
            )}
        </>
    );
}

