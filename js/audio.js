// ============================================================
// AUDIO — effetti sonori e musica generati con WebAudio
// ============================================================
(function () {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicOn = true;
  let musicTimer = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(dur) {
    const c = ensure();
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, dur, type, vol, slideTo, when) {
    if (muted) return;
    const c = ensure();
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, slideTo, when) {
    if (muted) return;
    const c = ensure();
    const t = c.currentTime + (when || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const SFX = {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },

    pistol() { noise(0.08, 0.5, 3000, 600); tone(220, 0.06, 'square', 0.15, 80); },
    flame() { noise(0.16, 0.22, 700, 250); },
    alarm() {
      for (let i = 0; i < 3; i++) {
        tone(880, 0.18, 'square', 0.1, null, i * 0.4);
        tone(660, 0.18, 'square', 0.1, null, i * 0.4 + 0.2);
      }
    },
    waveClear() {
      tone(523, 0.1, 'square', 0.14);
      tone(784, 0.1, 'square', 0.14, null, 0.1);
      tone(1046, 0.16, 'square', 0.14, null, 0.2);
    },
    mg() { noise(0.06, 0.4, 4000, 800); tone(180, 0.05, 'sawtooth', 0.12, 60); },
    spread() { noise(0.22, 0.7, 2200, 300); tone(120, 0.15, 'square', 0.2, 40); },
    rocket() { noise(0.4, 0.5, 1200, 2500); tone(90, 0.3, 'sawtooth', 0.18, 200); },
    knife() { noise(0.08, 0.35, 6000, 1500); tone(900, 0.06, 'triangle', 0.12, 1400); },
    throwG() { tone(500, 0.12, 'triangle', 0.12, 900); },
    bounce() { tone(300, 0.05, 'triangle', 0.1, 200); },
    explosion() {
      noise(0.6, 0.9, 900, 80);
      tone(70, 0.45, 'sawtooth', 0.35, 25);
      tone(50, 0.6, 'sine', 0.4, 20);
    },
    bigExplosion() {
      noise(1.0, 1.0, 700, 60);
      tone(55, 0.8, 'sawtooth', 0.4, 18);
      tone(40, 1.0, 'sine', 0.5, 15);
    },
    jump() { tone(250, 0.12, 'square', 0.08, 480); },
    land() { noise(0.06, 0.2, 700, 200); },
    hurt() { tone(400, 0.25, 'sawtooth', 0.25, 60); noise(0.2, 0.3, 1500, 300); },
    enemyDie() { tone(300, 0.2, 'square', 0.15, 70); noise(0.15, 0.25, 2000, 400); },
    pickup() { tone(660, 0.08, 'square', 0.15); tone(880, 0.1, 'square', 0.15, null, 0.08); tone(1320, 0.14, 'square', 0.15, null, 0.16); },
    pow() { tone(523, 0.1, 'square', 0.13); tone(659, 0.1, 'square', 0.13, null, 0.1); tone(784, 0.18, 'square', 0.13, null, 0.2); },
    bossHit() { tone(150, 0.08, 'square', 0.15, 90); noise(0.06, 0.2, 2500, 600); },
    heliBomb() { tone(900, 0.6, 'sine', 0.1, 250); },
    tankShot() { noise(0.3, 0.7, 1500, 200); tone(90, 0.25, 'square', 0.3, 35); },
    victory() {
      const seq = [523, 523, 523, 659, 784, 1046];
      seq.forEach((f, i) => tone(f, 0.22, 'square', 0.18, null, i * 0.16));
    },
    gameover() {
      const seq = [392, 370, 349, 330];
      seq.forEach((f, i) => tone(f, 0.4, 'square', 0.18, null, i * 0.35));
    },
  };

  // --- musica adattiva: 3 livelli di intensità (calmo / azione / boss) ---
  const PATTERNS = [
    [82.41, 82.41, 98, 82.41, 82.41, 73.42, 98, 110],          // 0: pattugliamento
    [82.41, 82.41, 110, 82.41, 98, 82.41, 110, 123.47],        // 1: azione
    [82.41, 110, 82.41, 123.47, 82.41, 110, 146.83, 123.47],   // 2: boss / orde
  ];
  const TEMPO = [200, 178, 150];
  let intensity = 0;
  let step = 0;

  function musicTick() {
    if (muted || !musicOn) return;
    const pat = PATTERNS[intensity];
    const f = pat[step % pat.length];
    tone(f, 0.18, 'triangle', 0.16);
    if (step % 2 === 0) noise(0.03, 0.06, 7000, 5000);
    if (step % 8 === 4) noise(0.1, 0.12, 900, 300);
    if (intensity >= 1 && step % 4 === 3) tone(f * 2, 0.08, 'square', 0.05);
    if (intensity >= 2) {
      if (step % 4 === 2) noise(0.08, 0.16, 1400, 400); // rullante
      if (step % 8 === 7) tone(f * 1.5, 0.1, 'sawtooth', 0.06);
    }
    step++;
  }

  SFX.startMusic = function () {
    ensure();
    if (musicTimer) return;
    musicTimer = setInterval(musicTick, TEMPO[intensity]);
  };
  SFX.stopMusic = function () {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  };
  SFX.setIntensity = function (lvl) {
    lvl = Math.max(0, Math.min(2, lvl | 0));
    if (lvl === intensity) return;
    intensity = lvl;
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = setInterval(musicTick, TEMPO[intensity]);
    }
  };
  SFX.toggleMusic = function () { musicOn = !musicOn; return musicOn; };

  window.SFX = SFX;
})();
