import * as React from "react";

export type PlaybackMode = 'data-saver' | 'instant';

type State = {
  audioEnabled: boolean;
  mode: PlaybackMode;
  setAudioEnabled: (on: boolean) => void;
  setMode: (m: PlaybackMode) => void;
};

const Ctx = React.createContext<State | undefined>(undefined);

const MODE_KEY = 'playback:mode';
const AUDIO_KEY = 'playback:audioEnabled';

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(() => localStorage.getItem(AUDIO_KEY) === '1');
  const [mode, setMode] = React.useState<PlaybackMode>(() => (localStorage.getItem(MODE_KEY) as PlaybackMode) || 'data-saver');

  React.useEffect(() => { localStorage.setItem(AUDIO_KEY, audioEnabled ? '1' : '0'); }, [audioEnabled]);
  React.useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  const value = React.useMemo<State>(() => ({ audioEnabled, mode, setAudioEnabled, setMode }), [audioEnabled, mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider');
  return ctx;
}

