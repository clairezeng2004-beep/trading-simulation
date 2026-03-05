/**
 * Trading Floor Audio Manager
 * Authentic open-outcry trading floor ambience using Web Audio API.
 * Layers: crowd murmur, pit shouting, keyboard/terminal clicks,
 * room tone (HVAC + fluorescent hum), distant phone rings, PA/intercom chimes,
 * paper rustling, and occasional bell/gong sounds.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let isPlaying = false;
let _volume = 0.35;

// Interval handles
let phoneInterval: ReturnType<typeof setInterval> | null = null;
let shoutInterval: ReturnType<typeof setInterval> | null = null;
let paperInterval: ReturnType<typeof setInterval> | null = null;
let bellInterval: ReturnType<typeof setInterval> | null = null;
let intercomInterval: ReturnType<typeof setInterval> | null = null;

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
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }
  return buffer;
}

// ─── Layer 1: Crowd murmur (thick, warm, lower-pitched) ───

function createCrowdMurmur(ctx: AudioContext, dest: AudioNode) {
  // Multiple pink noise layers at different voice frequency bands
  const nodes: AudioNode[] = [];

  // Low male voices murmur
  const buf1 = createNoiseBuffer(ctx, 6, 'pink');
  const src1 = ctx.createBufferSource();
  src1.buffer = buf1;
  src1.loop = true;
  const bp1 = ctx.createBiquadFilter();
  bp1.type = 'bandpass';
  bp1.frequency.value = 350;
  bp1.Q.value = 0.6;
  const g1 = ctx.createGain();
  g1.gain.value = 0.14;
  // Slow breathing-like modulation
  const lfo1 = ctx.createOscillator();
  lfo1.type = 'sine';
  lfo1.frequency.value = 0.15;
  const lfoG1 = ctx.createGain();
  lfoG1.gain.value = 0.04;
  lfo1.connect(lfoG1);
  lfoG1.connect(g1.gain);
  lfo1.start();
  src1.connect(bp1);
  bp1.connect(g1);
  g1.connect(dest);
  src1.start();
  nodes.push(src1, lfo1);

  // Mid-range voice chatter
  const buf2 = createNoiseBuffer(ctx, 5, 'pink');
  const src2 = ctx.createBufferSource();
  src2.buffer = buf2;
  src2.loop = true;
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'bandpass';
  bp2.frequency.value = 900;
  bp2.Q.value = 0.7;
  const lp2 = ctx.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.frequency.value = 2500;
  const g2 = ctx.createGain();
  g2.gain.value = 0.10;
  // Irregular modulation for crowd dynamics
  const lfo2 = ctx.createOscillator();
  lfo2.type = 'sine';
  lfo2.frequency.value = 0.22;
  const lfoG2 = ctx.createGain();
  lfoG2.gain.value = 0.05;
  lfo2.connect(lfoG2);
  lfoG2.connect(g2.gain);
  lfo2.start();
  src2.connect(bp2);
  bp2.connect(lp2);
  lp2.connect(g2);
  g2.connect(dest);
  src2.start();
  nodes.push(src2, lfo2);

  // Higher voice overtones (distant yelling texture)
  const buf3 = createNoiseBuffer(ctx, 4, 'pink');
  const src3 = ctx.createBufferSource();
  src3.buffer = buf3;
  src3.loop = true;
  const bp3 = ctx.createBiquadFilter();
  bp3.type = 'bandpass';
  bp3.frequency.value = 1800;
  bp3.Q.value = 1.0;
  const g3 = ctx.createGain();
  g3.gain.value = 0.04;
  const lfo3 = ctx.createOscillator();
  lfo3.type = 'sine';
  lfo3.frequency.value = 0.35;
  const lfoG3 = ctx.createGain();
  lfoG3.gain.value = 0.025;
  lfo3.connect(lfoG3);
  lfoG3.connect(g3.gain);
  lfo3.start();
  src3.connect(bp3);
  bp3.connect(g3);
  g3.connect(dest);
  src3.start();
  nodes.push(src3, lfo3);

  return nodes;
}

// ─── Layer 2: Pit shouting — periodic bursts of louder crowd noise ───

function startPitShouts(ctx: AudioContext, dest: AudioNode) {
  const playPitBurst = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    const duration = 0.3 + Math.random() * 0.5;

    // Burst of voice-frequency noise
    const buf = createNoiseBuffer(ctx, 1, 'pink');
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Formant-like bandpass
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400 + Math.random() * 800;
    bp.Q.value = 1.5 + Math.random() * 1.5;

    // Second formant
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'peaking';
    bp2.frequency.value = 1200 + Math.random() * 600;
    bp2.gain.value = 6;
    bp2.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, now + 0.03);
    gain.gain.setValueAtTime(0.04 + Math.random() * 0.02, now + duration * 0.4);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(bp2);
    bp2.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + duration + 0.05);
  };

  shoutInterval = setInterval(() => {
    if (Math.random() < 0.5) playPitBurst();
    // Sometimes a quick double-shout
    if (Math.random() < 0.15) {
      setTimeout(playPitBurst, 150 + Math.random() * 200);
    }
  }, 2000 + Math.random() * 3000);
}

// ─── Layer 3: Keyboard/terminal clicks (more mechanical, less hissy) ───

function createTerminalClicks(ctx: AudioContext, dest: AudioNode) {
  const buffer = createNoiseBuffer(ctx, 2, 'white');
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Sharper high-pass for click character
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4000;

  // Resonance peak for mechanical click
  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 5500;
  peak.gain.value = 4;
  peak.Q.value = 3;

  const gain = ctx.createGain();
  gain.gain.value = 0.012;

  // Irregular clicking pattern
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.008;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();

  source.connect(hp);
  hp.connect(peak);
  peak.connect(gain);
  gain.connect(dest);
  source.start();

  return [source, lfo];
}

// ─── Layer 4: Room tone (HVAC hum + fluorescent light buzz) ───

function createRoomTone(ctx: AudioContext, dest: AudioNode) {
  // 60Hz mains hum
  const hum60 = ctx.createOscillator();
  hum60.type = 'sine';
  hum60.frequency.value = 60;
  const g60 = ctx.createGain();
  g60.gain.value = 0.025;

  // 120Hz harmonic
  const hum120 = ctx.createOscillator();
  hum120.type = 'sine';
  hum120.frequency.value = 120;
  const g120 = ctx.createGain();
  g120.gain.value = 0.012;

  // Fluorescent light buzz (very subtle high-frequency)
  const buzz = ctx.createOscillator();
  buzz.type = 'sawtooth';
  buzz.frequency.value = 240;
  const buzzGain = ctx.createGain();
  buzzGain.gain.value = 0.003;
  const buzzLP = ctx.createBiquadFilter();
  buzzLP.type = 'lowpass';
  buzzLP.frequency.value = 400;

  // HVAC whoosh - brown noise, very low
  const hvacBuf = createNoiseBuffer(ctx, 4, 'brown');
  const hvac = ctx.createBufferSource();
  hvac.buffer = hvacBuf;
  hvac.loop = true;
  const hvacLP = ctx.createBiquadFilter();
  hvacLP.type = 'lowpass';
  hvacLP.frequency.value = 200;
  const hvacG = ctx.createGain();
  hvacG.gain.value = 0.03;

  hum60.connect(g60); g60.connect(dest);
  hum120.connect(g120); g120.connect(dest);
  buzz.connect(buzzLP); buzzLP.connect(buzzGain); buzzGain.connect(dest);
  hvac.connect(hvacLP); hvacLP.connect(hvacG); hvacG.connect(dest);

  hum60.start(); hum120.start(); buzz.start(); hvac.start();

  return [hum60, hum120, buzz, hvac];
}

// ─── Layer 5: Phone rings (multi-line, more realistic) ───

function startPhoneRings(ctx: AudioContext, dest: AudioNode) {
  const playRing = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;

    // Classic dual-tone phone ring
    const freq1 = 350 + Math.random() * 100;
    const freq2 = freq1 * 1.25;

    // Ring pattern: ring-ring ... ring-ring
    for (let burst = 0; burst < 2; burst++) {
      const t = now + burst * 0.3;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq1;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.012, t + 0.02);
      gain.gain.setValueAtTime(0.012, t + 0.12);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);

      // Add some distance/room effect
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2000 + Math.random() * 1000;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(lp);
      lp.connect(dest);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.2);
      osc2.stop(t + 0.2);
    }
  };

  phoneInterval = setInterval(() => {
    if (Math.random() < 0.5) playRing();
  }, 6000 + Math.random() * 10000);
}

// ─── Layer 6: Paper rustling / shuffling ───

function startPaperRustling(ctx: AudioContext, dest: AudioNode) {
  const playRustle = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    const duration = 0.05 + Math.random() * 0.1;

    const buf = createNoiseBuffer(ctx, 0.5, 'white');
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000 + Math.random() * 3000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.008 + Math.random() * 0.006, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + duration + 0.05);
  };

  paperInterval = setInterval(() => {
    if (Math.random() < 0.35) {
      playRustle();
      // Sometimes multiple quick shuffles
      if (Math.random() < 0.3) {
        setTimeout(playRustle, 60 + Math.random() * 100);
        if (Math.random() < 0.3) {
          setTimeout(playRustle, 150 + Math.random() * 100);
        }
      }
    }
  }, 4000 + Math.random() * 6000);
}

// ─── Layer 7: Occasional bell/gong (opening/closing bell vibe) ───

function startTradingBells(ctx: AudioContext, dest: AudioNode) {
  const playBell = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    const freq = 800 + Math.random() * 600;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Bell harmonics
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.76; // inharmonic overtone

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.006, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain); gain.connect(dest);
    osc2.connect(g2); g2.connect(dest);
    osc.start(now); osc2.start(now);
    osc.stop(now + 1); osc2.stop(now + 0.7);
  };

  bellInterval = setInterval(() => {
    if (Math.random() < 0.2) playBell();
  }, 15000 + Math.random() * 25000);
}

// ─── Layer 8: Distant PA/intercom chime ───

function startIntercomChimes(ctx: AudioContext, dest: AudioNode) {
  const playChime = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;

    // Two-tone intercom chime (ding-dong)
    const freqs = [523.25, 392.00]; // C5, G4
    freqs.forEach((freq, i) => {
      const t = now + i * 0.25;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      // Distance effect
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;

      osc.connect(gain);
      gain.connect(lp);
      lp.connect(dest);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  };

  intercomInterval = setInterval(() => {
    if (Math.random() < 0.15) playChime();
  }, 20000 + Math.random() * 40000);
}

// ─── News broadcast alert ───

export function playNewsAlert() {
  if (!isPlaying) return;
  const ctx = getCtx();
  const dest = getMaster();
  const now = ctx.currentTime;

  // Urgent three-tone news alert (like Bloomberg terminal)
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

  // Market closing bell — sustained ring
  const bellFreq = 660;
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.35;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = bellFreq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = bellFreq * 2.76;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.03, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain); gain.connect(dest);
    osc2.connect(g2); g2.connect(dest);
    osc.start(t); osc2.start(t);
    osc.stop(t + 0.8); osc2.stop(t + 0.6);
  }
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

  const crowd = createCrowdMurmur(ctx, dest);
  const terminals = createTerminalClicks(ctx, dest);
  const room = createRoomTone(ctx, dest);

  ambientNodes = [...crowd, ...terminals, ...room];

  startPhoneRings(ctx, dest);
  startPitShouts(ctx, dest);
  startPaperRustling(ctx, dest);
  startTradingBells(ctx, dest);
  startIntercomChimes(ctx, dest);
}

export function stopAmbient() {
  if (!isPlaying) return;
  isPlaying = false;

  if (phoneInterval) { clearInterval(phoneInterval); phoneInterval = null; }
  if (shoutInterval) { clearInterval(shoutInterval); shoutInterval = null; }
  if (paperInterval) { clearInterval(paperInterval); paperInterval = null; }
  if (bellInterval) { clearInterval(bellInterval); bellInterval = null; }
  if (intercomInterval) { clearInterval(intercomInterval); intercomInterval = null; }

  const ctx = audioCtx;
  if (ctx && masterGain) {
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  }

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
    return true;
  } else {
    masterGain.gain.linearRampToValueAtTime(_volume, audioCtx.currentTime + 0.1);
    return false;
  }
}
