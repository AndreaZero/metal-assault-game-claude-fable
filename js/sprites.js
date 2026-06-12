// ============================================================
// SPRITES — pixel art generata da mappe di caratteri
// ============================================================
(function () {
  const SCALE = 3;

  function makeCanvas(rows, palette, scale) {
    scale = scale || SCALE;
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        g.fillStyle = palette[ch] || '#f0f';
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }

  function flip(canvas) {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d');
    g.translate(c.width, 0);
    g.scale(-1, 1);
    g.drawImage(canvas, 0, 0);
    return c;
  }

  // versione bianca pre-renderizzata (flash quando colpiti, evita ctx.filter)
  function whiteOf(canvas) {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d');
    g.drawImage(canvas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function pair(rows, palette) {
    const r = makeCanvas(rows, palette);
    const l = flip(r);
    return { r: r, l: l, rw: whiteOf(r), lw: whiteOf(l), w: r.width, h: r.height };
  }

  // ---------------- palette ----------------
  const PLAYER_PAL = {
    r: '#c23b22', k: '#e8b486', e: '#26221c', u: '#5a7d3c', U: '#3e5a28',
    p: '#6f8a4a', b: '#4a3621', g: '#3a3a3f', G: '#9a9aa4', w: '#ffffff',
  };
  const ENEMY_PAL = {
    r: '#8a8d7a', k: '#dba275', e: '#26221c', u: '#a08a52', U: '#7a6739',
    p: '#8f7c4a', b: '#3f3221', g: '#3a3a3f', G: '#9a9aa4', w: '#ffffff',
  };
  // truppe d'élite (bazooka): uniforme cremisi, elmetto scuro
  const ELITE_PAL = {
    r: '#3a3a44', k: '#dba275', e: '#26221c', u: '#8a4a3a', U: '#63342a',
    p: '#7a4438', b: '#2f2418', g: '#3a3a3f', G: '#9a9aa4', w: '#ffffff',
  };
  const POW_PAL = {
    h: '#5a4630', k: '#e8b486', e: '#26221c', c: '#7a6248', R: '#caa86a',
  };

  // ---------------- corpo: torso (13 righe x 18 col) ----------------
  const TORSO_FWD = [
    '......rrrrr.......',
    '.....rrkkkkr......',
    '.....kkkkkkk......',
    '.....kkkekk.......',
    '......kkkkk.......',
    '.....uuuuuu.......',
    '....uuuuuuuu......',
    '....Uuuuuuukk.....',
    '....Uuuuuukkgggggg',
    '....Uuuuuuu.gGG...',
    '....uuuuuuu.......',
    '.....uuuuu........',
    '.....pppppp.......',
  ];
  const TORSO_UP = [
    '.........GG.......',
    '.........gg.......',
    '.........gg.......',
    '......rrrgg.......',
    '.....rrkkgg.......',
    '.....kkkkkk.......',
    '.....kkkekk.......',
    '.....uuuukk.......',
    '....uuuuuuk.......',
    '....Uuuuuu........',
    '....uuuuuuu.......',
    '.....uuuuu........',
    '.....pppppp.......',
  ];

  // ---------------- gambe (6 righe x 18 col) ----------------
  const LEGS_STAND = [
    '.....pp..pp.......',
    '.....pp..pp.......',
    '.....pp..pp.......',
    '.....pp..pp.......',
    '.....bb..bb.......',
    '....bbb..bbb......',
  ];
  const LEGS_RUN0 = [
    '....pp....pp......',
    '....pp....pp......',
    '...pp......pp.....',
    '...pp......pp.....',
    '...bb......bb.....',
    '..bbb......bbb....',
  ];
  const LEGS_RUN1 = [
    '.....pp.pp........',
    '.....pp.pp........',
    '.....pppp.........',
    '......ppp.........',
    '......bb..........',
    '.....bbb..........',
  ];
  const LEGS_RUN2 = [
    '.....pp..pp.......',
    '....pp....pp......',
    '....pp....pp......',
    '....bb.....pp.....',
    '...bbb.....bb.....',
    '...........bbb....',
  ];
  const LEGS_JUMP = [
    '.....pp..pp.......',
    '.....pp..pp.......',
    '....pp....pp......',
    '....bb....bb......',
    '...bbb....bb......',
    '..........bbb.....',
  ];

  // ---------------- accovacciato (13 righe) ----------------
  const CROUCH = [
    '......rrrrr.......',
    '.....rrkkkkr......',
    '.....kkkkkkk......',
    '.....kkkekk.......',
    '.....uuuuuu.......',
    '....uuuuuuuukk....',
    '....Uuuuuukkgggggg',
    '....Uuuuuuu.gGG...',
    '....uuuuuuuu......',
    '....pppppppp......',
    '....pp....pp......',
    '....bb....bb......',
    '...bbb....bbb.....',
  ];

  // ---------------- POW ----------------
  const POW_TIED = [
    '......hhhh........',
    '.....hkkkkh.......',
    '.....kkekek.......',
    '......kkkk........',
    '.....cccccc.......',
    '....ccRRRRcc......',
    '....ccRRRRcc......',
    '....cccccc........',
    '.....cccc.........',
    '....cc..cc........',
    '....cc..cc........',
    '...ccc..ccc.......',
  ];
  const POW_FREE = [
    '....kk....kk......',
    '....kkhhhhkk......',
    '.....hkkkkh.......',
    '....ckkekekc......',
    '....cckkkkcc......',
    '....cccccc........',
    '....cccccc........',
    '.....cccc.........',
    '....cc..cc........',
    '....cc..cc........',
    '...ccc..ccc.......',
  ];

  function buildBody(torso, legs, pal) {
    return pair(torso.concat(legs), pal);
  }

  function buildSet(pal) {
    return {
      idle: buildBody(TORSO_FWD, LEGS_STAND, pal),
      run: [
        buildBody(TORSO_FWD, LEGS_RUN0, pal),
        buildBody(TORSO_FWD, LEGS_RUN1, pal),
        buildBody(TORSO_FWD, LEGS_RUN2, pal),
        buildBody(TORSO_FWD, LEGS_RUN1, pal),
      ],
      runUp: [
        buildBody(TORSO_UP, LEGS_RUN0, pal),
        buildBody(TORSO_UP, LEGS_RUN1, pal),
        buildBody(TORSO_UP, LEGS_RUN2, pal),
        buildBody(TORSO_UP, LEGS_RUN1, pal),
      ],
      idleUp: buildBody(TORSO_UP, LEGS_STAND, pal),
      jump: buildBody(TORSO_FWD, LEGS_JUMP, pal),
      jumpUp: buildBody(TORSO_UP, LEGS_JUMP, pal),
      crouch: pair(CROUCH, pal),
    };
  }

  const Sprites = {
    scale: SCALE,
    player: buildSet(PLAYER_PAL),
    enemy: buildSet(ENEMY_PAL),
    elite: buildSet(ELITE_PAL),
    powTied: pair(POW_TIED, POW_PAL),
    powFree: pair(POW_FREE, POW_PAL),
  };

  // disegna uno sprite con piedi al punto (x, y), facing 1 = destra
  // white = true: silhouette bianca (flash da colpo)
  Sprites.draw = function (g, spr, x, y, facing, alpha, white) {
    const img = white ? (facing < 0 ? spr.lw : spr.rw) : (facing < 0 ? spr.l : spr.r);
    if (alpha !== undefined && alpha < 1) {
      g.save(); g.globalAlpha = Math.max(0, alpha);
      g.drawImage(img, Math.round(x - spr.w / 2), Math.round(y - spr.h));
      g.restore();
    } else {
      g.drawImage(img, Math.round(x - spr.w / 2), Math.round(y - spr.h));
    }
  };

  // sprite ruotato (per cadaveri che volano via)
  Sprites.drawRotated = function (g, spr, x, y, facing, angle, alpha) {
    const img = facing < 0 ? spr.l : spr.r;
    g.save();
    g.globalAlpha = Math.max(0, alpha === undefined ? 1 : alpha);
    g.translate(x, y - spr.h / 2);
    g.rotate(angle);
    g.drawImage(img, -spr.w / 2, -spr.h / 2);
    g.restore();
  };

  // ============================================================
  // VEICOLI E BOSS — disegnati a rettangoli
  // ============================================================

  // Tank nemico (~110x60), x,y = centro base
  Sprites.drawTank = function (g, x, y, facing, tread, flash) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (facing > 0) g.scale(-1, 1); // il tank di default guarda a sinistra
    const body = flash ? '#cdb89a' : '#6e6a4e';
    const dark = flash ? '#b0a080' : '#4e4a36';
    // cingoli
    g.fillStyle = '#2e2c22';
    g.fillRect(-52, -18, 104, 18);
    g.fillStyle = '#4a4636';
    for (let i = 0; i < 9; i++) {
      const tx = -50 + ((i * 12 + Math.floor(tread)) % 100);
      g.fillRect(tx, -16, 6, 14);
    }
    // scafo
    g.fillStyle = body;
    g.fillRect(-50, -34, 100, 18);
    g.fillStyle = dark;
    g.fillRect(-50, -22, 100, 5);
    // torretta
    g.fillStyle = body;
    g.fillRect(-22, -52, 44, 20);
    g.fillStyle = dark;
    g.fillRect(-22, -38, 44, 4);
    // cannone (verso sinistra dopo lo scale)
    g.fillStyle = '#3a3830';
    g.fillRect(-72, -48, 52, 7);
    g.fillStyle = '#55524a';
    g.fillRect(-72, -48, 8, 7);
    // stella
    g.fillStyle = '#b03a2e';
    g.fillRect(-6, -31, 12, 10);
    g.restore();
  };

  // Elicottero (~120x50), x,y = centro
  Sprites.drawHeli = function (g, x, y, facing, rotorPhase, flash) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (facing > 0) g.scale(-1, 1);
    const body = flash ? '#cdb89a' : '#5e6e4e';
    const dark = flash ? '#b0a080' : '#46523a';
    // coda
    g.fillStyle = dark;
    g.fillRect(18, -6, 50, 9);
    g.fillRect(60, -16, 8, 22);
    // fusoliera
    g.fillStyle = body;
    g.fillRect(-34, -16, 58, 30);
    g.fillStyle = dark;
    g.fillRect(-34, 6, 58, 8);
    // cabina
    g.fillStyle = '#9ad0e8';
    g.fillRect(-32, -12, 18, 14);
    // pattini
    g.fillStyle = '#33312a';
    g.fillRect(-30, 18, 50, 4);
    g.fillRect(-22, 14, 4, 6);
    g.fillRect(8, 14, 4, 6);
    // rotore
    g.fillStyle = '#23211c';
    g.fillRect(-4, -22, 6, 8);
    const sp = Math.sin(rotorPhase * 30);
    const len = 56 * Math.abs(sp) + 12;
    g.fillRect(-len, -24, len * 2, 4);
    // mitragliatrice frontale
    g.fillStyle = '#3a3830';
    g.fillRect(-46, 0, 14, 5);
    g.restore();
  };

  // Boss: fortezza corazzata (~240x150), x,y = centro base
  Sprites.drawBoss = function (g, x, y, facing, tread, flash, cannonRecoil) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (facing > 0) g.scale(-1, 1);
    const body = flash ? '#d8c8a8' : '#5c5a48';
    const dark = flash ? '#bcae90' : '#403e30';
    const accent = flash ? '#e0d0b0' : '#73705a';
    // cingoli giganti
    g.fillStyle = '#26241c';
    g.fillRect(-110, -30, 220, 30);
    g.fillStyle = '#3e3c2e';
    for (let i = 0; i < 16; i++) {
      const tx = -106 + ((i * 14 + Math.floor(tread)) % 212);
      g.fillRect(tx, -26, 8, 24);
    }
    // scafo principale
    g.fillStyle = body;
    g.fillRect(-105, -78, 210, 50);
    g.fillStyle = dark;
    g.fillRect(-105, -40, 210, 12);
    // piastre
    g.fillStyle = accent;
    for (let i = 0; i < 5; i++) g.fillRect(-95 + i * 42, -74, 30, 8);
    // torre superiore
    g.fillStyle = body;
    g.fillRect(-55, -118, 110, 42);
    g.fillStyle = dark;
    g.fillRect(-55, -84, 110, 8);
    // cannone principale (verso sinistra)
    const rec = cannonRecoil || 0;
    g.fillStyle = '#312f26';
    g.fillRect(-150 + rec, -108, 100, 14);
    g.fillStyle = '#4a4838';
    g.fillRect(-150 + rec, -108, 14, 14);
    // mitragliatrice secondaria
    g.fillStyle = '#312f26';
    g.fillRect(-128, -62, 30, 8);
    // teschio insegna
    g.fillStyle = '#ddd5c0';
    g.fillRect(-12, -110, 24, 18);
    g.fillStyle = '#26241c';
    g.fillRect(-8, -104, 6, 6);
    g.fillRect(2, -104, 6, 6);
    g.fillRect(-4, -96, 8, 3);
    g.restore();
  };

  // muro di sacchi di sabbia per le postazioni torretta
  Sprites.drawSandbags = function (g, x, y) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    const bag = (bx, by) => {
      g.fillStyle = '#b09a6a';
      g.fillRect(bx, by, 24, 11);
      g.fillStyle = '#8a7850';
      g.fillRect(bx, by + 8, 24, 3);
      g.fillRect(bx, by, 3, 11);
    };
    bag(-36, -11); bag(-12, -11); bag(12, -11);
    bag(-24, -21); bag(0, -21);
    bag(-12, -31);
    g.restore();
  };

  // cassa pickup con lettera
  Sprites.drawCrate = function (g, x, y, letter, color) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.fillStyle = '#7a5c34';
    g.fillRect(-13, -26, 26, 26);
    g.fillStyle = '#5e4626';
    g.fillRect(-13, -26, 26, 4);
    g.fillRect(-13, -4, 26, 4);
    g.fillStyle = color || '#fff';
    g.font = 'bold 16px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText(letter, 0, -8);
    g.restore();
  };

  // SLUG: carro alleato pilotabile (~76x50 + cannone), x,y = centro base
  // di default guarda a DESTRA (al contrario di drawTank)
  Sprites.drawSlug = function (g, x, y, facing, tread, flash, occupied, cannonRecoil) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (facing < 0) g.scale(-1, 1);
    const body = flash ? '#c8dca8' : '#5a7d3c';
    const dark = flash ? '#a8bc88' : '#3e5a28';
    const accent = flash ? '#d4e4b8' : '#6f8a4a';
    // cingoli tozzi
    g.fillStyle = '#2e2c22';
    g.fillRect(-34, -16, 68, 16);
    g.fillRect(-38, -12, 76, 8);
    g.fillStyle = '#4a4636';
    for (let i = 0; i < 6; i++) {
      const tx = -32 + ((i * 11 + Math.floor(tread)) % 64);
      g.fillRect(tx, -14, 5, 12);
    }
    // scafo arrotondato (rettangoli sovrapposti per simulare le curve)
    g.fillStyle = body;
    g.fillRect(-36, -30, 72, 16);
    g.fillRect(-32, -34, 64, 6);
    g.fillStyle = dark;
    g.fillRect(-36, -19, 72, 5);
    g.fillStyle = accent;
    g.fillRect(-30, -33, 56, 3);
    // torretta a cupola
    g.fillStyle = body;
    g.fillRect(-16, -46, 32, 14);
    g.fillRect(-12, -50, 24, 6);
    g.fillStyle = dark;
    g.fillRect(-16, -35, 32, 3);
    // portello + pilota (se occupato spunta la testa)
    if (occupied) {
      g.fillStyle = '#e8b486';
      g.fillRect(-5, -56, 10, 8);
      g.fillStyle = '#c23b22';
      g.fillRect(-6, -58, 12, 4);
    } else {
      g.fillStyle = dark;
      g.fillRect(-7, -52, 14, 4);
    }
    // cannone in avanti (verso destra), arretra di cannonRecoil
    const rec = cannonRecoil || 0;
    g.fillStyle = '#3a3830';
    g.fillRect(14 - rec, -45, 46, 7);
    g.fillStyle = '#55524a';
    g.fillRect(54 - rec, -45, 6, 7);
    // stella bianca sul fianco
    g.fillStyle = '#ffffff';
    g.fillRect(-6, -28, 8, 8);
    g.fillRect(-9, -25, 14, 2);
    g.restore();
  };

  // barile esplosivo (~22x30), x,y = centro base a terra
  Sprites.drawBarrel = function (g, x, y, flash) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    const red = flash ? '#e88a7e' : '#b03a2e';
    const dark = flash ? '#c06a5a' : '#7a2a20';
    g.fillStyle = red;
    g.fillRect(-11, -28, 22, 28);
    // fasce scure
    g.fillStyle = dark;
    g.fillRect(-11, -28, 22, 3);
    g.fillRect(-11, -16, 22, 3);
    g.fillRect(-11, -4, 22, 3);
    // tappo
    g.fillStyle = '#3a3830';
    g.fillRect(-4, -30, 8, 3);
    // teschio stilizzato
    g.fillStyle = '#ffffff';
    g.fillRect(-4, -13, 8, 6);
    g.fillStyle = dark;
    g.fillRect(-3, -11, 2, 2);
    g.fillRect(1, -11, 2, 2);
    g.fillStyle = '#ffffff';
    g.fillRect(-2, -7, 4, 2);
    g.restore();
  };

  // cassa di legno distruttibile (~30x26), x,y = centro base a terra
  Sprites.drawWoodCrate = function (g, x, y, flash) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    const wood = flash ? '#d8c098' : '#8a6a3c';
    const edge = flash ? '#b89c70' : '#6e5430';
    const cross = flash ? '#a88a5c' : '#5e4626';
    g.fillStyle = wood;
    g.fillRect(-15, -26, 30, 26);
    // bordi
    g.fillStyle = edge;
    g.fillRect(-15, -26, 30, 3);
    g.fillRect(-15, -3, 30, 3);
    g.fillRect(-15, -26, 3, 26);
    g.fillRect(12, -26, 3, 26);
    // croce di rinforzo diagonale
    g.fillStyle = cross;
    for (let i = 0; i < 5; i++) {
      g.fillRect(-11 + i * 4, -22 + i * 4, 5, 4);
      g.fillRect(6 - i * 4, -22 + i * 4, 5, 4);
    }
    g.restore();
  };

  // indicatore di pericolo per mortai: x,y = punto d'impatto, t = secondi rimanenti
  Sprites.drawWarning = function (g, x, y, t) {
    // lampeggio sempre più rapido man mano che t scende
    if (Math.floor(t * (6 + (0.7 - t) * 30)) % 2 !== 0) return;
    g.save();
    g.translate(Math.round(x), Math.round(y));
    // ellisse schiacciata a terra
    g.globalAlpha = 0.35;
    g.fillStyle = '#e83a2a';
    g.beginPath();
    g.save();
    g.scale(1, 8 / 24);
    g.arc(0, 0, 24, 0, Math.PI * 2);
    g.restore();
    g.fill();
    // punto esclamativo con ombra nera
    g.globalAlpha = 1;
    g.fillStyle = '#000000';
    g.fillRect(-2, -29, 6, 12);
    g.fillRect(-2, -13, 6, 5);
    g.fillStyle = '#e83a2a';
    g.fillRect(-3, -30, 6, 12);
    g.fillRect(-3, -14, 6, 5);
    g.restore();
  };

  window.Sprites = Sprites;
})();
