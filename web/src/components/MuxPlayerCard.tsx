// MuxPlayerCard.tsx
export default function MuxPlayerCard({
    active, title, index, total
}: {
    active: boolean;
    title: string;
    index: number;
    total: number;
}) {
    return (
        <>
            <div className="title">{title}</div>
            <div className="badge">{index} / {total}</div>
        </>
    );
}

