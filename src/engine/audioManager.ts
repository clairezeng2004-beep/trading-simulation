/**
 * Trading Floor Audio Manager
 * Uses Web Audio API to procedurally generate ambient trading floor sounds,
 * news broadcast alerts, and trade execution sounds.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let isPlaying = false;
let _volume = 0.35;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = _volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

// ─── Noise generators ───

function createNoiseBuffer(ctx: AudioContext, duration: number, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let lastOut = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      data[i] = white;
    } else if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      // brown noise
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }
  return buffer;
}

// ─── Ambient crowd/chatter layer ───

function createCrowdChatter(ctx: AudioContext, dest: AudioNode) {
  // Pink noise filtered to sound like distant crowd murmur
  const buffer = createNoiseBuffer(ctx, 4, 'pink');
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Bandpass filter to simulate human voice frequencies
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 0.8;

  // Second filter for warmth
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2000;

  const gain = ctx.createGain();
  gain.gain.value = 0.18;

  // Slow amplitude modulation to simulate chatter dynamics
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();

  source.connect(bp);
  bp.connect(lp);
  lp.connect(gain);
  gain.connect(dest);
  source.start();

  return [source, lfo];
}

// ─── Keyboard/typing sounds layer ───

function createKeyboardClatter(ctx: AudioContext, dest: AudioNode) {
  // High-frequency noise bursts simulating keyboards
  const buffer = createNoiseBuffer(ctx, 2, 'white');
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;

  const gain = ctx.createGain();
  gain.gain.value = 0.02;

  // Fast random modulation
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 8;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();

  source.connect(hp);
  hp.connect(gain);
  gain.connect(dest);
  source.start();

  return [source, lfo];
}

// ─── Low hum / HVAC layer ───

function createRoomHum(ctx: AudioContext, dest: AudioNode) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 60;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 120;

  const gain = ctx.createGain();
  gain.gain.value = 0.03;

  const gain2 = ctx.createGain();
  gain2.gain.value = 0.015;

  osc.connect(gain);
  osc2.connect(gain2);
  gain.connect(dest);
  gain2.connect(dest);
  osc.start();
  osc2.start();

  return [osc, osc2];
}

// ─── Distant phone ringing layer ───

let phoneInterval: ReturnType<typeof setInterval> | null = null;

function startPhoneRings(ctx: AudioContext, dest: AudioNode) {
  const playRing = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440 + Math.random() * 400;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = osc.frequency.value * 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.015, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1000;
    bp.Q.value = 5;

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(bp);
    bp.connect(dest);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.2);
    osc2.stop(now + 0.2);

    // Double ring
    setTimeout(() => {
      if (!isPlaying) return;
      const now2 = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = osc.frequency.value;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now2);
      g.gain.linearRampToValueAtTime(0.012, now2 + 0.05);
      g.gain.linearRampToValueAtTime(0, now2 + 0.15);
      o.connect(g);
      g.connect(bp);
      o.start(now2);
      o.stop(now2 + 0.2);
    }, 250);
  };

  // Random phone rings every 8-20 seconds
  phoneInterval = setInterval(() => {
    if (Math.random() < 0.6) playRing();
  }, 8000 + Math.random() * 12000);
}

// ─── Random shouts/exclamations layer ───

let shoutInterval: ReturnType<typeof setInterval> | null = null;

function startRandomShouts(ctx: AudioContext, dest: AudioNode) {
  const playShout = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    const freq = 200 + Math.random() * 300;
    const duration = 0.1 + Math.random() * 0.15;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * (0.7 + Math.random() * 0.6), now + duration);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 800;
    bp.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.015, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  };

  shoutInterval = setInterval(() => {
    if (Math.random() < 0.4) playShout();
  }, 3000 + Math.random() * 5000);
}

// ─── News broadcast alert ───

export function playNewsAlert() {
  if (!isPlaying) return;
  const ctx = getCtx();
  const dest = getMaster();
  const now = ctx.currentTime;

  // Three-tone news jingle
  const freqs = [880, 1100, 880];
  const durations = [0.08, 0.08, 0.12];
  let offset = 0;

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.08, now + offset + 0.01);
    gain.gain.setValueAtTime(0.08, now + offset + durations[i] - 0.02);
    gain.gain.linearRampToValueAtTime(0, now + offset + durations[i]);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now + offset);
    osc.stop(now + offset + durations[i] + 0.01);
    offset += durations[i] + 0.03;
  });
}

// ─── Trade execution sound ───

export function playTradeSound() {
  if (!isPlaying) return;
  const ctx = getCtx();
  const dest = getMaster();
  const now = ctx.currentTime;

  // Quick "ka-ching" type sound
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(2400, now + 0.05);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + 0.2);

  // Metallic overtone
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 3200;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.04, now + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc2.connect(g2);
  g2.connect(dest);
  osc2.start(now + 0.02);
  osc2.stop(now + 0.15);
}

// ─── Timer warning sound ───

export function playTimerWarning() {
  if (!isPlaying) return;
  const ctx = getCtx();
  const dest = getMaster();
  const now = ctx.currentTime;

  // Urgent double beep
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.18;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

// ─── Game over sound ───

export function playGameOverSound() {
  const ctx = getCtx();
  const dest = getMaster();
  const now = ctx.currentTime;

  // Descending bell tone
  const freqs = [880, 660, 440];
  freqs.forEach((freq, i) => {
    const t = now + i * 0.25;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

// ─── Master controls ───

export function startAmbient() {
  if (isPlaying) return;
  const ctx = getCtx();
  const dest = getMaster();
  isPlaying = true;

  // Fade in
  dest.gain.setValueAtTime(0, ctx.currentTime);
  dest.gain.linearRampToValueAtTime(_volume, ctx.currentTime + 2);

  const crowd = createCrowdChatter(ctx, dest);
  const keyboard = createKeyboardClatter(ctx, dest);
  const hum = createRoomHum(ctx, dest);

  ambientNodes = [...crowd, ...keyboard, ...hum];

  startPhoneRings(ctx, dest);
  startRandomShouts(ctx, dest);
}

export function stopAmbient() {
  if (!isPlaying) return;
  isPlaying = false;

  if (phoneInterval) { clearInterval(phoneInterval); phoneInterval = null; }
  if (shoutInterval) { clearInterval(shoutInterval); shoutInterval = null; }

  const ctx = audioCtx;
  if (ctx && masterGain) {
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  }

  // Stop ambient sources after fade out
  setTimeout(() => {
    ambientNodes.forEach(node => {
      try {
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
          node.stop();
        }
      } catch {}
    });
    ambientNodes = [];
  }, 1200);
}

export function pauseAmbient() {
  if (!audioCtx || !masterGain) return;
  if (isPlaying) {
    masterGain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 0.5);
  }
}

export function resumeAmbient() {
  if (!audioCtx || !masterGain) return;
  if (isPlaying) {
    audioCtx.resume();
    masterGain.gain.linearRampToValueAtTime(_volume, audioCtx.currentTime + 0.5);
  }
}

export function setVolume(vol: number) {
  _volume = Math.max(0, Math.min(1, vol));
  if (masterGain && audioCtx && isPlaying) {
    masterGain.gain.linearRampToValueAtTime(_volume, audioCtx.currentTime + 0.1);
  }
}

export function getVolume(): number {
  return _volume;
}

export function isSoundPlaying(): boolean {
  return isPlaying;
}

export function toggleMute(): boolean {
  if (!masterGain || !audioCtx) return false;
  if (masterGain.gain.value > 0.01) {
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    return true; // muted
  } else {
    masterGain.gain.linearRampToValueAtTime(_volume, audioCtx.currentTime + 0.1);
    return false; // unmuted
  }
}
