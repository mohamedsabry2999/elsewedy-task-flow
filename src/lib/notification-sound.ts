// Tiny WebAudio synth for notification sounds — no external MP3 assets needed.
let ctx: AudioContext | null = null;
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    // Play a silent buffer to satisfy autoplay policies.
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination); src.start(0);
    unlocked = true;
  } catch { /* ignore */ }
}

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, duration: number, volume: number, when = 0) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0, c.currentTime + when);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + duration);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(c.currentTime + when);
  osc.stop(c.currentTime + when + duration + 0.05);
}

export function playNormal(volume = 0.6) {
  if (!unlocked) return;
  tone(880, 0.15, volume * 0.5, 0);
  tone(1320, 0.2, volume * 0.4, 0.12);
}

export function playSiren(volume = 0.9) {
  if (!unlocked) return;
  const v = volume * 0.5;
  for (let i = 0; i < 3; i++) {
    tone(700, 0.18, v, i * 0.35);
    tone(1050, 0.18, v, i * 0.35 + 0.18);
  }
}
