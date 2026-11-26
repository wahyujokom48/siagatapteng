let audioCtx: AudioContext | null = null;
let sirenTimer: number | null = null;

/**
 * Memutar bunyi sirine peringatan darurat menggunakan Web Audio API (tanpa file audio eksternal)
 */
export function startSiren(durationMs = 6000) {
  stopSiren();
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  audioCtx = new AudioCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(650, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.18, audioCtx.currentTime);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();

  let high = true;
  const sweep = window.setInterval(() => {
    if (!audioCtx) return;
    osc.frequency.linearRampToValueAtTime(high ? 1050 : 620, audioCtx.currentTime + 0.45);
    high = !high;
  }, 500);

  sirenTimer = window.setTimeout(() => {
    window.clearInterval(sweep);
    stopSiren();
  }, durationMs);

  (osc as unknown as { _sweep?: number })._sweep = sweep;
}

export function stopSiren() {
  if (sirenTimer !== null) {
    window.clearTimeout(sirenTimer);
    sirenTimer = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if ('wakeLock' in navigator) {
      return await navigator.wakeLock.request('screen');
    }
  } catch {
    // Browser tidak mendukung atau tab tidak aktif
  }
  return null;
}
