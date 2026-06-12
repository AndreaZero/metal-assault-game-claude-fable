// ============================================================
// GAME — loop principale, stati, modalità, camera, HUD
// ============================================================
(function () {
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const VW = canvas.width, VH = canvas.height;

  const ARENA_X = 350; // camera fissa della modalità survival

  // ---------- stato globale ----------
  window.G = {
    state: 'menu',
    mode: 'arcade',
    menuSel: 0,
    paused: false,
    time: 0,
    score: 0,
    hiA: parseInt(localStorage.getItem('ma_hiscore') || '0', 10),
    hiS: parseInt(localStorage.getItem('ma_hiscore_surv') || '0', 10),
    lives: 3,
    camX: 0,
    camLockL: 0,
    camLockR: Level.W,
    shake: 0,
    hitStop: 0,
    hurtFlash: 0,
    combo: { n: 0, t: 0 },
    player: null,
    enemies: [], pBullets: [], eBullets: [], grenades: [],
    particles: [], flashes: [], corpses: [], pows: [],
    pickups: [], scorePops: [],
    slugs: [], props: [], warnings: [],
    boss: null,
    bossTriggered: false,
    spawnIdx: 0,
    bannerT: 0,
    winT: 0,
    overT: 0,
    // survival
    wave: 0,
    waveQueue: [],
    waveSpawnT: 0,
    waveBreakT: 0,
    waveBanner: 0,
  };

  G.gameOver = function () {
    G.state = 'gameover';
    G.overT = 0;
    SFX.stopMusic();
    SFX.gameover();
    saveHi();
  };

  G.victory = function () {
    G.state = 'win';
    G.winT = 0;
    G.score += G.lives * 1000; // bonus vite rimaste
    SFX.stopMusic();
    SFX.victory();
    saveHi();
  };

  function saveHi() {
    if (G.mode === 'survival') {
      if (G.score > G.hiS) {
        G.hiS = G.score;
        localStorage.setItem('ma_hiscore_surv', String(G.hiS));
      }
    } else if (G.score > G.hiA) {
      G.hiA = G.score;
      localStorage.setItem('ma_hiscore', String(G.hiA));
    }
  }

  function currentHi() { return G.mode === 'survival' ? G.hiS : G.hiA; }

  function startGame(mode) {
    G.mode = mode;
    G.state = 'play';
    G.paused = false;
    G.score = 0;
    G.lives = 3;
    G.shake = 0;
    G.hitStop = 0;
    G.hurtFlash = 0;
    G.combo = { n: 0, t: 0 };
    G.enemies = []; G.pBullets = []; G.eBullets = []; G.grenades = [];
    G.particles = []; G.flashes = []; G.corpses = []; G.pows = [];
    G.pickups = []; G.scorePops = [];
    G.slugs = []; G.props = []; G.warnings = [];
    G.boss = null;
    G.bossTriggered = false;
    G.spawnIdx = 0;
    G.bannerT = 0;

    if (mode === 'survival') {
      G.camX = ARENA_X;
      G.camLockL = ARENA_X;
      G.camLockR = ARENA_X + VW;
      G.player = Entities.createPlayer(ARENA_X + VW / 2);
      G.wave = 0;
      G.waveQueue = [];
      G.waveSpawnT = 0;
      G.waveBreakT = 1.6;
      G.waveBanner = 0;
      // barili esplosivi nell'arena
      Entities.spawnProp(ARENA_X + 170, 'barrel');
      Entities.spawnProp(ARENA_X + VW - 170, 'barrel');
      SFX.setIntensity(1);
    } else {
      G.camX = 0;
      G.camLockL = 0;
      G.camLockR = Level.W;
      G.player = Entities.createPlayer(120);
      // SLUG parcheggiati e oggetti distruttibili lungo la missione
      for (const sx of Level.slugSpawns) Entities.spawnSlug(sx);
      for (const pr of Level.props) Entities.spawnProp(pr.x, pr.type);
      SFX.setIntensity(0);
    }
    SFX.startMusic();
  }

  // ---------- spawn progressivo (arcade) ----------
  function handleSpawns() {
    const limit = G.camX + VW + 240;
    while (G.spawnIdx < Level.spawns.length && Level.spawns[G.spawnIdx].x < limit) {
      const s = Level.spawns[G.spawnIdx];
      if (s.type === 'pow') Entities.spawnPow(s.x);
      else Entities.spawnEnemy(s.type, s.x);
      G.spawnIdx++;
    }
    // trigger del boss
    if (!G.bossTriggered && G.player.x > Level.BOSS_TRIGGER_X) {
      G.bossTriggered = true;
      G.camLockL = Level.W - VW;
      Entities.spawnBoss();
      SFX.setIntensity(2);
      G.shake = Math.max(G.shake, 6);
    }
  }

  // ---------- modalità survival: ondate ----------
  function startWave(n) {
    G.wave = n;
    G.waveBanner = 2.2;
    const q = [];
    const inf = 2 + Math.min(8, Math.floor(n * 1.1));
    for (let i = 0; i < inf; i++) {
      const r = Math.random();
      if (n >= 4 && r < 0.18) q.push('bazooka');
      else if (n >= 2 && r < 0.4) q.push('knife');
      else if (n >= 3 && r < 0.6) q.push('grenadier');
      else q.push('soldier');
    }
    if (n % 5 === 0) q.push('gunship');
    else if (n % 3 === 0) q.push('heli');
    if (n >= 4 && n % 4 === 0) q.push('tank');
    G.waveQueue = q;
    G.waveSpawnT = 1.0;
    // ricompensa: uno SLUG fresco ogni 6 ondate
    if (n % 6 === 0 && G.slugs.length === 0) {
      Entities.spawnSlug(G.camX + VW / 2 + 120);
    }
    // rifornisci i barili dell'arena
    while (G.props.length < 2) {
      Entities.spawnProp(G.camX + 150 + Math.random() * (VW - 300), 'barrel');
    }
    SFX.setIntensity(n >= 8 ? 2 : 1);
  }

  function updateSurvival(dt) {
    if (G.waveBanner > 0) G.waveBanner -= dt;

    if (G.waveBreakT > 0) {
      G.waveBreakT -= dt;
      if (G.waveBreakT <= 0) startWave(G.wave + 1);
      return;
    }

    if (G.waveQueue.length > 0) {
      G.waveSpawnT -= dt;
      if (G.waveSpawnT <= 0) {
        const type = G.waveQueue.shift();
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side < 0 ? G.camX - 60 : G.camX + VW + 60;
        const e = Entities.spawnEnemy(type, x);
        e.spawnX = G.camX + VW / 2; // la pattuglia converge verso l'arena
        G.waveSpawnT = 0.7;
      }
    } else if (G.enemies.length === 0) {
      // ondata completata
      if (G.wave > 0) {
        const bonus = 300 + G.wave * 100;
        Entities.addScore(bonus, G.player.x, G.player.y - 80);
        SFX.waveClear();
        G.player.grenades = Math.min(99, G.player.grenades + 3);
        const cx = G.camX + 200 + Math.random() * (VW - 400);
        if (G.wave % 2 === 0) {
          const gifts = ['mg', 'spread', 'rocket', 'flame', 'grenades'];
          Entities.spawnPickup(cx, gifts[Math.floor(Math.random() * gifts.length)]);
        }
        if (G.wave % 4 === 0) Entities.spawnPow(cx);
      }
      G.waveBreakT = 2.5;
    }
  }

  // ---------- camera ----------
  function updateCamera(dt) {
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.mode === 'survival') return; // camera fissa
    let target = G.player.x - VW * 0.38;
    const minCam = G.bossTriggered ? Level.W - VW : 0;
    target = Math.max(minCam, Math.min(Level.W - VW, target));
    G.camX += (target - G.camX) * Math.min(1, dt * 6);
    G.camX = Math.max(minCam, Math.min(Level.W - VW, G.camX));
  }

  // ---------- update ----------
  function update(dt) {
    G.time += dt;

    if (G.state === 'menu') {
      if (Input.pressed('ArrowUp') || Input.pressed('KeyW') ||
          Input.pressed('ArrowDown') || Input.pressed('KeyS')) {
        G.menuSel = 1 - G.menuSel;
        SFX.bounce();
      }
      if (Input.start()) startGame(G.menuSel === 0 ? 'arcade' : 'survival');
      return;
    }
    if (G.state === 'gameover') {
      G.overT += dt;
      if (G.overT > 1 && Input.start()) G.state = 'menu';
      return;
    }
    if (G.state === 'win') {
      G.winT += dt;
      Entities.updateParticles(dt);
      Entities.updateScorePops(dt);
      if (G.winT > 2 && Input.start()) G.state = 'menu';
      return;
    }

    // --- play ---
    if (Input.pressed('KeyP')) G.paused = !G.paused;
    if (Input.pressed('KeyM')) SFX.toggleMute();
    if (G.paused) return;

    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    if (G.combo.t > 0) G.combo.t -= dt;

    // hit-stop: micro-congelamento del mondo per dare peso ai colpi
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      Entities.bufferInputs(); // non perdere i salti premuti durante il freeze
      updateCamera(dt);
      return;
    }

    G.bannerT += dt;
    if (G.mode === 'survival') updateSurvival(dt);
    else handleSpawns();
    Entities.updatePlayer(dt);
    Entities.updateSlugs(dt);
    Entities.updateEnemies(dt);
    Entities.updateBoss(dt);
    Entities.updateBullets(dt);
    Entities.updateGrenades(dt);
    Entities.updateWarnings(dt);
    Entities.updateProps(dt);
    Entities.updatePows(dt);
    Entities.updatePickups(dt);
    Entities.updateParticles(dt);
    Entities.updateScorePops(dt);
    updateCamera(dt);
  }

  // ---------- HUD ----------
  function text(str, x, y, size, color, align, bold) {
    g.font = (bold === false ? '' : 'bold ') + size + 'px "Courier New", monospace';
    g.textAlign = align || 'left';
    g.fillStyle = '#000';
    g.fillText(str, x + 2, y + 2);
    g.fillStyle = color || '#fff';
    g.fillText(str, x, y);
  }

  function drawHUD() {
    const p = G.player;
    text('SCORE ' + String(G.score).padStart(7, '0'), 16, 28, 18, '#ffe28a');
    text('HI ' + String(Math.max(currentHi(), G.score)).padStart(7, '0'), 16, 50, 14, '#caa86a');

    // catena di uccisioni
    if (G.combo.t > 0 && G.combo.n >= 2) {
      text('CHAIN x' + G.combo.n, 16, 72, 15, '#7ad0ff');
      g.fillStyle = '#000';
      g.fillRect(118, 63, 84, 8);
      g.fillStyle = '#7ad0ff';
      g.fillRect(120, 65, 80 * Math.max(0, G.combo.t / 2.2), 4);
    }

    // vite
    for (let i = 0; i < G.lives; i++) {
      const x = VW - 30 - i * 26;
      g.fillStyle = '#000';
      g.fillRect(x - 8 + 2, 14 + 2, 16, 16);
      g.fillStyle = '#c23b22';
      g.fillRect(x - 8, 14, 16, 6);
      g.fillStyle = '#e8b486';
      g.fillRect(x - 8, 20, 16, 10);
    }
    text('LIFE', VW - 16, 50, 13, '#fff', 'right');

    // arma e munizioni (o stato del veicolo)
    if (p.inSlug) {
      text('SLUG CANNON  ∞', 16, VH - 40, 16, '#9aff8a');
      text('ARMOR', 16, VH - 64, 13, '#9aff8a');
      for (let i = 0; i < p.inSlug.maxHp; i++) {
        g.fillStyle = '#000';
        g.fillRect(74 + i * 18, VH - 74, 14, 12);
        g.fillStyle = i < p.inSlug.hp ? '#9aff8a' : '#3a4a32';
        g.fillRect(76 + i * 18, VH - 72, 10, 8);
      }
    } else {
      const w = Entities.WEAPONS[p.weapon];
      const ammoStr = p.weapon === 'pistol' ? '∞' : String(p.ammo);
      text(w.name + '  ' + ammoStr, 16, VH - 40, 16, '#7ad0ff');
    }
    // granate
    g.fillStyle = '#000';
    g.fillRect(18, VH - 32 + 2, 10, 12);
    g.fillStyle = '#3e5a28';
    g.fillRect(16, VH - 32, 10, 12);
    g.fillStyle = '#222';
    g.fillRect(19, VH - 36, 4, 5);
    text('x ' + p.grenades, 34, VH - 20, 16, '#9aff8a');

    // barra HP del boss (arcade)
    if (G.boss && G.boss.state !== 'enter') {
      const bw = 420, bx = (VW - bw) / 2, by = 22;
      text('GENERAL MORDEN\'S FORTRESS', VW / 2, by - 6, 13, '#ff8a6a', 'center');
      g.fillStyle = '#000';
      g.fillRect(bx - 2, by, bw + 4, 14);
      g.fillStyle = '#5a1010';
      g.fillRect(bx, by + 2, bw, 10);
      g.fillStyle = '#e83a2a';
      g.fillRect(bx, by + 2, bw * Math.max(0, G.boss.hp / G.boss.maxHp), 10);
    }

    // indicatore ondata (survival)
    if (G.mode === 'survival') {
      if (G.wave > 0) text('WAVE ' + G.wave, VW / 2, 30, 22, '#ffae42', 'center');
      if (G.waveBanner > 0) {
        const a = G.waveBanner > 0.4 ? 1 : G.waveBanner / 0.4;
        g.save();
        g.globalAlpha = a;
        text('WAVE ' + G.wave, VW / 2, VH / 2 - 60, 46, '#ffae42', 'center');
        g.restore();
      } else if (G.waveBreakT > 0 && G.wave > 0) {
        text('GET READY...', VW / 2, VH / 2 - 60, 24, '#fff', 'center');
      }
    }

    // banner inizio missione (arcade)
    if (G.mode === 'arcade' && G.bannerT < 2.2) {
      const a = G.bannerT < 1.8 ? 1 : (2.2 - G.bannerT) / 0.4;
      g.save();
      g.globalAlpha = a;
      text('MISSION 1', VW / 2, VH / 2 - 40, 42, '#ffe28a', 'center');
      text('START!', VW / 2, VH / 2 + 8, 30, '#fff', 'center');
      g.restore();
    }

    // vignetta rossa quando si viene colpiti
    if (G.hurtFlash > 0) {
      g.save();
      g.globalAlpha = Math.min(0.45, G.hurtFlash * 0.8);
      const vg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.75);
      vg.addColorStop(0, 'rgba(180,20,10,0)');
      vg.addColorStop(1, 'rgba(180,20,10,1)');
      g.fillStyle = vg;
      g.fillRect(0, 0, VW, VH);
      g.restore();
    }

    if (G.paused) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 0, VW, VH);
      text('PAUSE', VW / 2, VH / 2, 40, '#fff', 'center');
      text('P per riprendere — M audio on/off', VW / 2, VH / 2 + 36, 16, '#aaa', 'center');
    }
  }

  // ---------- schermate ----------
  function drawMenu() {
    const menuCam = (G.time * 30) % (Level.W - VW);
    Level.drawBackground(g, menuCam, G.time, VW, VH);
    Level.drawGround(g, menuCam, VW, VH);

    // sprite decorativi
    Sprites.draw(g, Sprites.player.run[Math.floor(G.time * 10) % 4], VW * 0.3, Level.GROUND, 1);
    Sprites.drawTank(g, VW * 0.78, Level.GROUND, -1, G.time * 40, false);
    Sprites.draw(g, Sprites.enemy.run[Math.floor(G.time * 10 + 2) % 4], VW * 0.62, Level.GROUND, -1);

    g.fillStyle = 'rgba(10,8,20,0.45)';
    g.fillRect(0, 0, VW, VH);

    // titolo
    g.save();
    g.translate(VW / 2, 120);
    g.rotate(-0.02);
    text('METAL', 0, 0, 72, '#ffae42', 'center');
    text('ASSAULT', 0, 60, 72, '#e8e0c8', 'center');
    g.restore();
    text('~ run & gun ~', VW / 2, 212, 15, '#caa86a', 'center');

    // comandi
    const cx = VW / 2;
    text('FRECCE / WASD  muovi   ·   GIU\' abbassati   ·   SU mira in alto', cx, 262, 14, '#ddd', 'center');
    text('SPAZIO salta   ·   J/Z spara   ·   L/X granata   ·   coltello da vicino', cx, 284, 14, '#ddd', 'center');
    text('Tocca lo SLUG per salire a bordo   ·   L/X cannone   ·   GIU\'+SALTO esci', cx, 306, 14, '#9aff8a', 'center');
    text('P pausa   ·   M audio', cx, 328, 14, '#999', 'center');

    // selezione modalità
    const selA = G.menuSel === 0, selS = G.menuSel === 1;
    text((selA ? '> ' : '  ') + 'ARCADE MISSION', cx - 150, 366, 22, selA ? '#fff' : '#9a9a8a');
    text('HI ' + String(G.hiA).padStart(7, '0'), cx + 130, 366, 15, selA ? '#ffe28a' : '#8a7a5a');
    text((selS ? '> ' : '  ') + 'SURVIVAL', cx - 150, 402, 22, selS ? '#fff' : '#9a9a8a');
    text('HI ' + String(G.hiS).padStart(7, '0'), cx + 130, 402, 15, selS ? '#ffe28a' : '#8a7a5a');

    if (Math.floor(G.time * 2) % 2 === 0) {
      text('PRESS ENTER TO START', cx, 462, 22, '#fff', 'center');
    }
    text('Libera i prigionieri (POW) e concatena le uccisioni per punteggi piu\' alti!', cx, 510, 13, '#9aff8a', 'center');
  }

  function drawGameOver() {
    drawWorld();
    g.fillStyle = 'rgba(20,0,0,0.6)';
    g.fillRect(0, 0, VW, VH);
    text('GAME OVER', VW / 2, VH / 2 - 20, 56, '#e83a2a', 'center');
    text('SCORE  ' + String(G.score).padStart(7, '0'), VW / 2, VH / 2 + 30, 20, '#ffe28a', 'center');
    if (G.mode === 'survival') {
      text('WAVE RAGGIUNTA  ' + G.wave, VW / 2, VH / 2 + 58, 16, '#ffae42', 'center');
    }
    if (G.overT > 1 && Math.floor(G.time * 2) % 2 === 0) {
      text('PRESS ENTER', VW / 2, VH / 2 + 95, 20, '#fff', 'center');
    }
  }

  function drawWin() {
    drawWorld();
    g.fillStyle = 'rgba(0,10,30,0.55)';
    g.fillRect(0, 0, VW, VH);
    text('MISSION COMPLETE!', VW / 2, VH / 2 - 60, 46, '#9aff8a', 'center');
    if (G.winT > 0.8) text('SCORE  ' + String(G.score).padStart(7, '0'), VW / 2, VH / 2, 24, '#ffe28a', 'center');
    if (G.winT > 1.4) text('BONUS VITE  +' + (G.lives * 1000), VW / 2, VH / 2 + 34, 16, '#7ad0ff', 'center');
    if (G.winT > 2 && Math.floor(G.time * 2) % 2 === 0) {
      text('PRESS ENTER', VW / 2, VH / 2 + 90, 20, '#fff', 'center');
    }
  }

  // ---------- mondo ----------
  function drawWorld() {
    const shakeX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    const shakeY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    const cam = G.camX + shakeX;

    Level.drawBackground(g, cam, G.time, VW, VH);
    g.save();
    g.translate(0, shakeY);
    Level.drawGround(g, cam, VW, VH);
    Entities.drawWarnings(g, cam);
    Entities.drawProps(g, cam);
    Entities.drawPows(g, cam);
    Entities.drawPickups(g, cam);
    Entities.drawEnemies(g, cam);
    Entities.drawBoss(g, cam);
    Entities.drawSlugs(g, cam);
    if (G.player) Entities.drawPlayer(g, cam);
    Entities.drawGrenades(g, cam);
    Entities.drawBullets(g, cam);
    Entities.drawParticles(g, cam);
    Entities.drawScorePops(g, cam);
    g.restore();
  }

  // ---------- render ----------
  function render() {
    g.clearRect(0, 0, VW, VH);
    if (G.state === 'menu') { drawMenu(); return; }
    if (G.state === 'gameover') { drawGameOver(); return; }
    if (G.state === 'win') { drawWin(); return; }
    drawWorld();
    drawHUD();
  }

  // ---------- loop a passo fisso ----------
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      Input.endFrame();
      acc -= STEP;
    }
    render();
  }
  requestAnimationFrame(frame);

  // ---------- adattamento finestra ----------
  function resize() {
    const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = Math.floor(VW * scale) + 'px';
    canvas.style.height = Math.floor(VH * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();
})();
