export function useAutoplayViewport(cb: (v: boolean) => void, opts?: IntersectionObserverInit) {
    return (el: HTMLElement | null) => {
        if (!el) return;
            const io = new IntersectionObserver(([e]) => cb(e.isIntersecting && e.intersectionRatio >= 0.75), {
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: '0px',
            ...(opts || {})
        });
        io.observe(el);
    };
}