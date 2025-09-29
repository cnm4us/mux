export async function unlockMedia(): Promise<boolean> {
  try {
    // Create a short, muted-then-unmuted video to satisfy iOS policies.
    // We don't fetch network media; we rely on a silent WebAudio resume as fallback.
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        const ctx = new AudioCtx();
        await ctx.resume();
        // Create a short silent buffer to exercise audio pipeline
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.connect(ctx.destination); src.start(0);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

