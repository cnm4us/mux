import * as React from 'react';

// LocalStorage keys
const SOUND_KEY = 'sound:on';
const BUILD_LAST_KEY = 'build:lastSeen';

export default function WelcomePopover() {
  const [visible, setVisible] = React.useState<boolean>(() => localStorage.getItem(SOUND_KEY) !== '1');
  const [buildId, setBuildId] = React.useState<string | null>(null);
  const [builtAt, setBuiltAt] = React.useState<string | null>(null);
  const [hasDiff, setHasDiff] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const j = await res.json();
        const id = String(j?.buildId ?? '');
        const at = String(j?.builtAt ?? '');
        setBuildId(id || null);
        setBuiltAt(at || null);
        const last = localStorage.getItem(BUILD_LAST_KEY) || '';
        setHasDiff(!!id && !!last && last !== id);
      } catch {}
    })();
  }, []);

  if (!visible) return null;

  const start = async () => {
    setBusy(true);
    try {
      // Use the user gesture to enable sound across app
      try { window.dispatchEvent(new CustomEvent('mux:sound-on')); } catch {}
      localStorage.setItem(SOUND_KEY, '1');
      if (buildId) localStorage.setItem(BUILD_LAST_KEY, buildId);
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const reload = () => window.location.reload();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: '92%', maxWidth: 520, background: '#111', border: '1px solid #222', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
        <h2 style={{ margin: '0 0 8px' }}>Welcome</h2>
        <div style={{ fontSize: 12, opacity: 0.85, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>build:</span>
          <code>{buildId || 'unknown'}</code>
          {builtAt && <span>• {new Date(builtAt).toLocaleString()}</span>}
          {hasDiff && (
            <button className="btn" onClick={reload} style={{ marginLeft: 'auto' }}>Reload App</button>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Start'}
          </button>
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
            Enables sound and playback.
          </span>
        </div>
      </div>
    </div>
  );
}

