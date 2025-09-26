export default function MuxPlayerCard({
    active,
    title,
    index,
    total,
    soundOn,
    onTapSound
}: {
    active: boolean;
    title: string;
    index: number;
    total: number;
    soundOn: boolean;
    onTapSound: () => void;
}) {
    return (
        <>
            {/* Title */}
            <div className="title">{title}</div>

            {/* Index badge */}
            <div className="badge">{index} / {total}</div>

            {/* Sound prompt overlay (only when active and pref says sound on but iOS might have blocked it) */}
            {active && !soundOn && (
                <button
                    className="btn btn-compact"
                    style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        zIndex: 2
                    }}
                    onClick={onTapSound}
                >
                    🔇 Tap for sound
                </button>
            )}
        </>
    );
}
