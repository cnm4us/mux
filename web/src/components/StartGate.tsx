import * as React from 'react';
import { usePlayback } from '@/context/PlaybackContext';
import { useVersion } from '@/hooks/useVersion';
import { unlockMedia } from '@/hooks/useMediaUnlock';

export default function StartGate() {
  const { audioEnabled, setAudioEnabled, mode, setMode } = usePlayback();
  const { buildId, builtAt, hasUpdate, refresh } = useVersion();

  const [unlocking, setUnlocking] = React.useState(false);

  const onStart = async () => {
    setUnlocking(true);
    try {
      await unlockMedia();
      setAudioEnabled(true);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: '#111', border: '1px solid #222', borderRadius: 12, padding: 16 }}>
        <h1 style={{ margin: '8px 0 4px' }}>Welcome to XYZ</h1>
        <div style={{ fontSize: 13, opacity: 0.8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>build:</span>
          <code>{buildId || 'unknown'}</code>
          {builtAt && <span>• {new Date(builtAt).toLocaleString()}</span>}
          {hasUpdate && <button className="btn" onClick={refresh} style={{ marginLeft: 'auto' }}>Reload App</button>}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Playback Mode</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'data-saver'} onChange={() => setMode('data-saver')} />
              Data Saver (posters only)
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'instant'} onChange={() => setMode('instant')} />
              Instant (preload next)
            </label>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onStart} disabled={unlocking || audioEnabled}>
            {unlocking ? 'Starting…' : (audioEnabled ? 'Started' : 'Start')}
          </button>
          <span style={{ opacity: 0.8, fontSize: 13 }}>
            One tap enables audio playback across the app.
          </span>
        </div>
      </div>
    </div>
  );
}

