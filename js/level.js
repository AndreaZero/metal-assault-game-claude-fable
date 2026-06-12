// ============================================================
// LEVEL — terreno, piattaforme, scenografia a parallasse, spawn
// ============================================================
(function () {
  const W = 7600;
  const GROUND = 470;

  // piattaforme "one-way": ci si atterra sopra saltando
  const platforms = [
    { x: 1180, y: 392, w: 130 },
    { x: 2040, y: 384, w: 150 },
    { x: 3440, y: 392, w: 130 },
    { x: 4140, y: 380, w: 160 },
    { x: 5640, y: 392, w: 140 },
    { x: 6080, y: 380, w: 150 },
  ];

  // tabella spawn: attivati quando il giocatore si avvicina
  const spawns = [
    { x: 620, type: 'soldier' },
    { x: 780, type: 'soldier' },
    { x: 950, type: 'pow' },
    { x: 1150, type: 'grenadier' },
    { x: 1300, type: 'soldier' },
    { x: 1360, type: 'soldier' },
    { x: 1550, type: 'knife' },
    { x: 1700, type: 'soldier' },
    { x: 1840, type: 'turret' },
    { x: 1950, type: 'grenadier' },
    { x: 2150, type: 'pow' },
    { x: 2380, type: 'heli' },
    { x: 2480, type: 'bazooka' },
    { x: 2620, type: 'soldier' },
    { x: 2700, type: 'soldier' },
    { x: 2780, type: 'soldier' },
    { x: 2950, type: 'knife' },
    { x: 3010, type: 'knife' },
    { x: 3150, type: 'grenadier' },
    { x: 3380, type: 'tank' },
    { x: 3520, type: 'turret' },
    { x: 3650, type: 'pow' },
    { x: 3780, type: 'bazooka' },
    { x: 3850, type: 'soldier' },
    { x: 3930, type: 'soldier' },
    { x: 4150, type: 'gunship' }, // miniboss di metà missione
    { x: 4260, type: 'grenadier' },
    { x: 4340, type: 'soldier' },
    { x: 4550, type: 'knife' },
    { x: 4610, type: 'knife' },
    { x: 4780, type: 'tank' },
    { x: 4880, type: 'bazooka' },
    { x: 5050, type: 'pow' },
    { x: 5180, type: 'turret' },
    { x: 5250, type: 'soldier' },
    { x: 5330, type: 'soldier' },
    { x: 5410, type: 'soldier' },
    { x: 5560, type: 'heli' },
    { x: 5650, type: 'grenadier' },
    { x: 5880, type: 'tank' },
    { x: 5960, type: 'soldier' },
    { x: 5990, type: 'bazooka' },
    { x: 6250, type: 'pow' },
    { x: 6420, type: 'soldier' },
    { x: 6500, type: 'soldier' },
    { x: 6580, type: 'knife' },
    { x: 6680, type: 'turret' },
    { x: 6720, type: 'grenadier' },
    { x: 6800, type: 'grenadier' },
    { x: 6860, type: 'bazooka' },
  ];

  const BOSS_TRIGGER_X = 6950; // il boss appare quando il giocatore arriva qui
  const BOSS_X = 7350;         // posizione di stazionamento del boss

  // ---------------- scenografia (seeded, deterministica) ----------------
  function rng(seed) {
    let s = seed;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  const farMounts = [];
  {
    const r = rng(42);
    for (let x = -200; x < W * 0.4 + 400; x += 120 + r() * 160) {
      farMounts.push({ x: x, w: 220 + r() * 260, h: 90 + r() * 130 });
    }
  }
  const midRuins = [];
  {
    const r = rng(77);
    for (let x = -100; x < W * 0.7 + 400; x += 260 + r() * 380) {
      midRuins.push({
        x: x, w: 70 + r() * 130, h: 60 + r() * 140,
        broken: r() > 0.5, win: 1 + Math.floor(r() * 3),
      });
    }
  }
  const palms = [];
  {
    const r = rng(133);
    for (let x = 150; x < W; x += 280 + r() * 420) {
      palms.push({ x: x, h: 70 + r() * 60, lean: (r() - 0.5) * 0.5, fronds: 5 + Math.floor(r() * 3) });
    }
  }
  const groundProps = [];
  {
    const r = rng(99);
    for (let x = 200; x < W; x += 180 + r() * 320) {
      const t = r();
      groundProps.push({ x: x, type: t < 0.4 ? 'rock' : t < 0.7 ? 'grass' : 'skull', s: 0.6 + r() * 0.8 });
    }
  }
  const clouds = [];
  {
    const r = rng(7);
    for (let i = 0; i < 10; i++) {
      clouds.push({ x: r() * 1200, y: 30 + r() * 120, w: 80 + r() * 140, sp: 4 + r() * 8 });
    }
  }

  // ---------------- rendering ----------------
  function drawBackground(g, camX, time, VW, VH) {
    // cielo al tramonto
    const grad = g.createLinearGradient(0, 0, 0, GROUND);
    grad.addColorStop(0, '#1d2b4e');
    grad.addColorStop(0.45, '#7a4a5e');
    grad.addColorStop(0.8, '#d8854a');
    grad.addColorStop(1, '#e8a25a');
    g.fillStyle = grad;
    g.fillRect(0, 0, VW, VH);

    // sole
    g.fillStyle = '#ffd98a';
    g.beginPath();
    g.arc(VW * 0.72 - camX * 0.03, 150, 55, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,217,138,0.25)';
    g.beginPath();
    g.arc(VW * 0.72 - camX * 0.03, 150, 80, 0, Math.PI * 2);
    g.fill();

    // nuvole
    g.fillStyle = 'rgba(255,225,200,0.35)';
    for (const c of clouds) {
      const cx = ((c.x + time * c.sp - camX * 0.06) % (VW + 300)) - 150;
      g.fillRect(cx, c.y, c.w, 14);
      g.fillRect(cx + c.w * 0.2, c.y - 8, c.w * 0.5, 10);
    }

    // montagne lontane
    g.fillStyle = '#3a3450';
    for (const m of farMounts) {
      const mx = m.x - camX * 0.18;
      if (mx + m.w < -50 || mx > VW + 50) continue;
      g.beginPath();
      g.moveTo(mx, GROUND);
      g.lineTo(mx + m.w / 2, GROUND - m.h);
      g.lineTo(mx + m.w, GROUND);
      g.fill();
    }

    // rovine di mezzo piano
    for (const ru of midRuins) {
      const rx = ru.x - camX * 0.45;
      if (rx + ru.w < -50 || rx > VW + 50) continue;
      g.fillStyle = '#574a4a';
      g.fillRect(rx, GROUND - ru.h, ru.w, ru.h);
      if (ru.broken) {
        g.fillStyle = '#6a5a56';
        g.beginPath();
        g.moveTo(rx, GROUND - ru.h);
        g.lineTo(rx + ru.w * 0.4, GROUND - ru.h - 24);
        g.lineTo(rx + ru.w, GROUND - ru.h);
        g.fill();
      }
      g.fillStyle = '#2e2630';
      for (let i = 0; i < ru.win; i++) {
        g.fillRect(rx + 12 + i * 26, GROUND - ru.h + 18, 12, 18);
      }
    }
  }

  function drawPalm(g, p, camX) {
    const px = p.x - camX;
    g.save();
    g.translate(px, GROUND);
    g.rotate(p.lean * 0.3);
    g.fillStyle = '#5e4a30';
    g.fillRect(-5, -p.h, 10, p.h);
    g.fillStyle = '#4a3a24';
    for (let i = 1; i < 5; i++) g.fillRect(-5, -p.h * i / 5, 10, 3);
    g.fillStyle = '#3e6e2e';
    for (let i = 0; i < p.fronds; i++) {
      const a = (i / p.fronds) * Math.PI - Math.PI * 0.05;
      g.save();
      g.translate(0, -p.h);
      g.rotate(-a);
      g.fillRect(0, -4, 42, 8);
      g.restore();
    }
    g.restore();
  }

  function drawGround(g, camX, VW, VH) {
    // palme (primo piano dietro al terreno di gioco)
    for (const p of palms) {
      if (p.x - camX < -100 || p.x - camX > VW + 100) continue;
      drawPalm(g, p, camX);
    }

    // terreno
    g.fillStyle = '#7a5e38';
    g.fillRect(0, GROUND, VW, VH - GROUND);
    g.fillStyle = '#4e6e35';
    g.fillRect(0, GROUND, VW, 8);
    g.fillStyle = '#5e4a2c';
    for (let x = -((camX | 0) % 48); x < VW; x += 48) {
      g.fillRect(x, GROUND + 18, 22, 5);
      g.fillRect(x + 26, GROUND + 38, 16, 4);
    }

    // oggetti a terra
    for (const pr of groundProps) {
      const px = pr.x - camX;
      if (px < -60 || px > VW + 60) continue;
      if (pr.type === 'rock') {
        g.fillStyle = '#8a7a5e';
        g.fillRect(px, GROUND - 10 * pr.s, 18 * pr.s, 10 * pr.s);
        g.fillStyle = '#6e6048';
        g.fillRect(px + 3 * pr.s, GROUND - 5 * pr.s, 18 * pr.s, 5 * pr.s);
      } else if (pr.type === 'grass') {
        g.fillStyle = '#557a36';
        g.fillRect(px, GROUND - 8, 3, 8);
        g.fillRect(px + 5, GROUND - 12, 3, 12);
        g.fillRect(px + 10, GROUND - 7, 3, 7);
      } else {
        g.fillStyle = '#d8d0b8';
        g.fillRect(px, GROUND - 8, 10, 8);
        g.fillStyle = '#26241c';
        g.fillRect(px + 2, GROUND - 6, 2, 2);
        g.fillRect(px + 6, GROUND - 6, 2, 2);
      }
    }

    // piattaforme (casse blindate)
    for (const pl of platforms) {
      const px = pl.x - camX;
      if (px + pl.w < -20 || px > VW + 20) continue;
      g.fillStyle = '#6a5a3c';
      g.fillRect(px, pl.y, pl.w, 14);
      g.fillStyle = '#857244';
      g.fillRect(px, pl.y, pl.w, 4);
      g.fillStyle = '#4a3e28';
      for (let sx = px + 8; sx < px + pl.w - 8; sx += 24) g.fillRect(sx, pl.y + 5, 4, 6);
      // gambe di supporto
      g.fillStyle = '#52452e';
      g.fillRect(px + 6, pl.y + 14, 8, GROUND - pl.y - 14);
      g.fillRect(px + pl.w - 14, pl.y + 14, 8, GROUND - pl.y - 14);
    }
  }

  window.Level = {
    W: W,
    GROUND: GROUND,
    platforms: platforms,
    spawns: spawns,
    BOSS_TRIGGER_X: BOSS_TRIGGER_X,
    BOSS_X: BOSS_X,
    drawBackground: drawBackground,
    drawGround: drawGround,
  };
})();
