import { useEffect, useMemo, useRef, useState } from 'react'
import MuxPlayerCard from "./MuxPlayerCard";
import { fetchFeed, getPlayUrl, type FeedItem } from '../hooks/useFeed'


export default function Feed() {
    const [items, setItems] = useState<FeedItem[]>([])
    const [cursor, setCursor] = useState<string | undefined>()
    const [active, setActive] = useState(0)
    const [urls, setUrls] = useState<Record<string, string>>({})
    const containerRef = useRef<HTMLDivElement | null>(null)


    useEffect(() => {
        let mounted = true
        fetchFeed().then(({ items, nextCursor }) => {
            if (!mounted) return
            setItems(items)
            setCursor(nextCursor)
        })
        return () => { mounted = false }
    }, [])


    // Load play URLs lazily for active and next
    useEffect(() => {
        const target = items[active]
        const next = items[active + 1]
        const toLoad = [target, next].filter(Boolean) as FeedItem[]
        toLoad.forEach((it) => {
            if (!it || urls[it.id]) return
            getPlayUrl(it.id).then((u) => setUrls((m) => ({ ...m, [it.id]: u }))).catch(() => { })
        })
    }, [active, items])


    // Infinite load when user passes N-2
    useEffect(() => {
        if (items.length === 0 || !cursor) return
        if (active < items.length - 2) return
        let mounted = true
        fetchFeed(cursor).then(({ items: more, nextCursor }) => {
            if (!mounted) return
            setItems((prev) => [...prev, ...more])
            setCursor(nextCursor)
        }).catch(() => { })
        return () => { mounted = false }
    }, [active, cursor, items.length])


    // Track which card is on screen
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const cards = Array.from(el.querySelectorAll('[data-idx]')) as HTMLElement[]
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    const idx = Number((e.target as HTMLElement).dataset.idx)
                    if (!Number.isNaN(idx)) setActive(idx)
                }
            })
        }, { root: el, threshold: 0.6 })
        cards.forEach((c) => obs.observe(c))
        return () => obs.disconnect()
    }, [items.length])


    return (
        <div ref={containerRef} className="feed">
            {items.map((it, i) => (
                <section className="card" key={it.id} data-idx={i}>
                    <MuxPlayerCard src={urls[it.id]} active={i === active} />
                    <div className="title">{it.title || "Untitled"}</div>
                    <div className="badge">{i + 1} / {items.length}</div>
                </section>
            ))}
            {items.length === 0 && (
                <section className="card"><div>Loading feed…</div></section>
            )}
        </div>
    )
}