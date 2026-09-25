let ctx: AudioContext | null = null;

/** Unlock audio; browsers only allow it after a user gesture. */
export function enableChime(): void {
  ctx ??= new AudioContext();
  void ctx.resume();
}

/** A short two-note chime for a new ticket (KDS-06). Silent until enabled. */
export function chime(): void {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.16);
    osc.stop(now + i * 0.16 + 0.16);
  }
}
