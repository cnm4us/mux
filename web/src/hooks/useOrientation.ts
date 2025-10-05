import { useEffect, useMemo, useState } from "react";

function computeIsPortrait(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    return h >= w;
  } catch {
    return (window.innerHeight || 1) >= (window.innerWidth || 1);
  }
}

export function useOrientation() {
  const [isPortrait, setIsPortrait] = useState<boolean>(() => computeIsPortrait());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => setIsPortrait(computeIsPortrait());
    const mq = window.matchMedia('(orientation: portrait)');
    try { mq.addEventListener('change', onChange); } catch { /* older Safari */ }
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange as any);
    (window as any).visualViewport?.addEventListener?.('resize', onChange);
    return () => {
      try { mq.removeEventListener('change', onChange); } catch {}
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange as any);
      (window as any).visualViewport?.removeEventListener?.('resize', onChange);
    };
  }, []);

  return useMemo(() => ({ isPortrait, orientation: (isPortrait ? 'portrait' : 'landscape') as const }), [isPortrait]);
}

