import * as React from 'react';

export function useVersion() {
  const [buildId, setBuildId] = React.useState<string | null>(null);
  const [builtAt, setBuiltAt] = React.useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = React.useState(false);

  const fetchVersion = React.useCallback(async () => {
    try {
      const base = (import.meta as any).env.BASE_URL || '/';
      const url = base.replace(/\/$/, '') + '/version.json';
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return;
      const j = await res.json();
      const id = String(j?.buildId ?? '');
      if (buildId && id && id !== buildId) setHasUpdate(true);
      setBuildId(id || null);
      setBuiltAt(String(j?.builtAt ?? '') || null);
    } catch {}
  }, [buildId]);

  React.useEffect(() => {
    fetchVersion();
    const onMsg = (ev: MessageEvent) => {
      const t = (ev.data && ev.data.type) || '';
      if (t === 'NEW_VERSION_AVAILABLE') setHasUpdate(true);
    };
    navigator.serviceWorker?.addEventListener('message', onMsg as any);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg as any);
  }, [fetchVersion]);

  return { buildId, builtAt, hasUpdate, refresh: () => window.location.reload(), refetch: fetchVersion };
}
