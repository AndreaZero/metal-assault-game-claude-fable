// ============================================================
// ENTITIES — giocatore, nemici, proiettili, esplosioni, boss
// (opera sullo stato globale G definito in game.js)
// ============================================================
(function () {
  const GRAV = 2200;
  const P_W = 24, P_H = 54, P_H_CROUCH = 36;

  const WEAPONS = {
    pistol: { name: 'PISTOL', rate: 0.16, auto: false, ammo: Infinity, recoil: 3 },
    mg:     { name: 'HEAVY M.G.', rate: 0.07, auto: true, ammo: 200, recoil: 2.2 },
    spread: { name: 'SPREAD', rate: 0.45, auto: false, ammo: 30, recoil: 6 },
    rocket: { name: 'ROCKET', rate: 0.5, auto: false, ammo: 25, recoil: 7 },
    flame:  { name: 'FLAME SHOT', rate: 0.055, auto: true, ammo: 90, recoil: 1.2 },
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ============================================================
  // PLAYER
  // ============================================================
  function createPlayer(x) {
    return {
      x: x, y: Level.GROUND, vx: 0, vy: 0,
      facing: 1, onGround: true, crouch: false, aimUp: false,
      weapon: 'pistol', ammo: Infinity, grenades: 10,
      fireT: 0, animT: 0, inv: 2.0, dead: false, deadT: 0,
      dropT: 0, knifeT: 0, runFrame: 0, recoil: 0,
    };
  }

  function playerHitbox(p) {
    const h = p.crouch ? P_H_CROUCH : P_H;
    return { x: p.x - P_W / 2, y: p.y - h, w: P_W, h: h };
  }

  function updatePlayer(dt) {
    const p = G.player;
    p.fireT -= dt;
    p.knifeT -= dt;
    p.dropT -= dt;
    p.recoil = Math.max(0, p.recoil - dt * 45);
    if (p.inv > 0) p.inv -= dt;

    if (p.dead) {
      p.deadT += dt;
      p.vy += GRAV * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.y > Level.GROUND) { p.y = Level.GROUND; p.vy = 0; p.vx *= 0.8; }
      if (p.deadT > 1.4) respawn();
      return;
    }

    // --- movimento orizzontale ---
    const speed = 270;
    p.crouch = p.onGround && Input.downDir();
    let move = 0;
    if (Input.left()) move -= 1;
    if (Input.right()) move += 1;
    if (p.crouch) move *= 0.45;
    p.vx = move * speed;
    if (move !== 0) p.facing = move > 0 ? 1 : -1;
    p.aimUp = Input.up();

    // --- salto / drop ---
    if (Input.jump()) {
      if (p.onGround) {
        if (p.crouch && onPlatform(p)) {
          p.dropT = 0.22; p.y += 4; p.onGround = false; p.vy = 120;
        } else {
          p.vy = -780; p.onGround = false; SFX.jump();
        }
      }
    }

    // --- fisica ---
    const wasAir = !p.onGround;
    p.vy += GRAV * dt;
    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, G.camLockL + 14, G.camLockR - 14);

    // atterraggio
    p.onGround = false;
    if (p.vy >= 0) {
      if (p.y >= Level.GROUND) {
        if (prevY <= Level.GROUND + 1) {
          p.y = Level.GROUND; p.vy = 0; p.onGround = true;
        }
      }
      if (!p.onGround && p.dropT <= 0) {
        for (const pl of Level.platforms) {
          if (p.x > pl.x - 4 && p.x < pl.x + pl.w + 4 &&
              prevY <= pl.y + 1 && p.y >= pl.y) {
            p.y = pl.y; p.vy = 0; p.onGround = true;
            break;
          }
        }
      }
      if (p.y > Level.GROUND) { p.y = Level.GROUND; p.vy = 0; p.onGround = true; }
    }

    // sbuffo di polvere all'atterraggio
    if (wasAir && p.onGround) {
      SFX.land();
      for (let i = 0; i < 5; i++) {
        G.particles.push({
          x: p.x + rnd(-12, 12), y: p.y, vx: rnd(-70, 70), vy: rnd(-60, -10),
          t: 0, life: rnd(0.2, 0.4), color: '#b09a6a', size: rnd(3, 6), grav: 200,
        });
      }
    }

    // --- animazione corsa ---
    if (p.onGround && move !== 0) {
      p.animT += dt * 10;
      p.runFrame = Math.floor(p.animT) % 4;
      // polvere occasionale dai piedi
      if (Math.random() < dt * 6) {
        G.particles.push({
          x: p.x - p.facing * 10, y: p.y, vx: -p.facing * rnd(20, 50), vy: rnd(-40, -10),
          t: 0, life: 0.3, color: '#a8946a', size: rnd(2, 4), grav: 150,
        });
      }
    } else {
      p.animT = 0; p.runFrame = 0;
    }

    // --- fuoco ---
    const w = WEAPONS[p.weapon];
    const wantFire = w.auto ? Input.fire() : Input.firePressed() || (Input.fire() && p.fireT < -0.12);
    if (wantFire && p.fireT <= 0) {
      const knifed = tryKnife(p);
      if (!knifed) firePlayerWeapon(p);
      p.fireT = w.rate;
    }

    // --- granata ---
    if (Input.grenade() && p.grenades > 0) {
      p.grenades--;
      G.grenades.push({
        kind: 'pgren', x: p.x + p.facing * 10, y: p.y - 44,
        vx: p.facing * 300 + p.vx * 0.35, vy: -440,
        t: 1.05, bounced: false,
      });
      SFX.throwG();
    }
  }

  function onPlatform(p) {
    if (p.y >= Level.GROUND) return false;
    return true;
  }

  function tryKnife(p) {
    for (const e of G.enemies) {
      if (e.dead || !isInfantry(e.type)) continue;
      const dx = e.x - p.x, dy = Math.abs(e.y - p.y);
      if (dy < 50 && Math.abs(dx) < 46 && (dx === 0 || (dx > 0) === (p.facing > 0))) {
        killEnemy(e, p.facing);
        p.knifeT = 0.18;
        SFX.knife();
        comboKill(150, e.x, e.y - 60);
        G.hitStop = Math.max(G.hitStop, 0.05);
        return true;
      }
    }
    return false;
  }

  function firePlayerWeapon(p) {
    const muzzleY = p.crouch ? p.y - 16 : p.y - 28;
    let mx, my, dirX, dirY;
    if (p.aimUp && !p.crouch) {
      mx = p.x + p.facing * 4; my = p.y - P_H - 6; dirX = 0; dirY = -1;
    } else {
      mx = p.x + p.facing * 28; my = muzzleY; dirX = p.facing; dirY = 0;
    }
    const spawnMuzzle = () => {
      for (let i = 0; i < 3; i++) {
        G.particles.push({
          x: mx, y: my, vx: dirX * rnd(60, 160) + rnd(-40, 40), vy: dirY * rnd(60, 160) + rnd(-40, 40),
          t: 0, life: 0.08, color: '#ffe28a', size: rnd(2, 5), grav: 0,
        });
      }
    };

    p.recoil = WEAPONS[p.weapon].recoil;

    // bossolo espulso (non per flame/rocket)
    if (p.weapon !== 'flame' && p.weapon !== 'rocket') {
      G.particles.push({
        x: p.x - p.facing * 6, y: my - 4,
        vx: -p.facing * rnd(60, 150), vy: rnd(-280, -160),
        t: 0, life: 0.7, color: '#d8b84a', size: 3, grav: 1100,
      });
    }

    if (p.weapon === 'spread') {
      SFX.spread();
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.16;
        const bvx = (dirX * Math.cos(a) - dirY * Math.sin(a)) * 760;
        const bvy = (dirX * Math.sin(a) + dirY * Math.cos(a)) * 760;
        G.pBullets.push({ x: mx, y: my, vx: bvx, vy: bvy, life: 0.32, dmg: 2, type: 'spread' });
      }
      spawnMuzzle();
    } else if (p.weapon === 'rocket') {
      SFX.rocket();
      G.pBullets.push({ x: mx, y: my, vx: dirX * 640, vy: dirY * 640, life: 2.2, dmg: 6, type: 'rocket' });
      spawnMuzzle();
    } else if (p.weapon === 'flame') {
      if (Math.random() < 0.35) SFX.flame();
      G.pBullets.push({
        x: mx, y: my,
        vx: dirX * 430 + rnd(-26, 26) + p.vx * 0.4,
        vy: dirY * 430 + rnd(-26, 26) - (dirY === 0 ? 24 : 0),
        life: 0.4, dmg: 1, type: 'flame', t: 0,
      });
    } else {
      if (p.weapon === 'mg') SFX.mg(); else SFX.pistol();
      const sp = p.weapon === 'mg' ? 980 : 900;
      const jit = p.weapon === 'mg' ? rnd(-30, 30) : 0;
      G.pBullets.push({
        x: mx, y: my,
        vx: dirX * sp + (dirY !== 0 ? jit : 0),
        vy: dirY * sp + (dirX !== 0 ? jit : 0),
        life: 0.9, dmg: 1, type: p.weapon,
      });
      spawnMuzzle();
    }

    if (p.weapon !== 'pistol') {
      p.ammo--;
      if (p.ammo <= 0) { p.weapon = 'pistol'; p.ammo = Infinity; }
    }
  }

  function killPlayer() {
    const p = G.player;
    if (p.dead || p.inv > 0) return;
    p.dead = true; p.deadT = 0;
    p.vy = -560; p.vx = -p.facing * 120;
    SFX.hurt();
    G.shake = Math.max(G.shake, 8);
    G.hurtFlash = 0.55;
    G.combo.t = 0; G.combo.n = 0; // la catena si spezza
    bloodBurst(p.x, p.y - 30, 10);
  }

  function respawn() {
    G.lives--;
    if (G.lives < 0) { G.gameOver(); return; }
    const p = G.player;
    p.dead = false; p.deadT = 0;
    p.x = clamp(p.x, G.camLockL + 40, G.camLockR - 40);
    p.y = -40; p.vy = 0; p.vx = 0;
    p.inv = 2.5;
    p.weapon = 'pistol'; p.ammo = Infinity;
    p.grenades = Math.max(p.grenades, 5);
  }

  function drawPlayer(g, camX) {
    const p = G.player;
    const S = Sprites.player;
    let spr;
    if (p.dead) {
      Sprites.drawRotated(g, S.idle, p.x - camX, p.y, p.facing, p.deadT * 6 * -p.facing, 1 - p.deadT / 1.6);
      return;
    }
    if (p.crouch) spr = S.crouch;
    else if (!p.onGround) spr = p.aimUp ? S.jumpUp : S.jump;
    else if (Math.abs(p.vx) > 10) spr = (p.aimUp ? S.runUp : S.run)[p.runFrame];
    else spr = p.aimUp ? S.idleUp : S.idle;

    const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0;
    const ox = -p.facing * p.recoil; // arretramento da rinculo
    Sprites.draw(g, spr, p.x - camX + ox, p.y, p.facing, blink ? 0.35 : 1);

    // lampo del coltello
    if (p.knifeT > 0) {
      g.save();
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x - camX + p.facing * 26, p.y - 34, 18, -1.1, 1.1);
      g.stroke();
      g.restore();
    }
  }

  // ============================================================
  // NEMICI
  // ============================================================
  function isInfantry(t) {
    return t === 'soldier' || t === 'grenadier' || t === 'knife' ||
           t === 'bazooka' || t === 'turret';
  }

  const ENEMY_PTS = {
    soldier: 100, knife: 150, grenadier: 150, bazooka: 200,
    turret: 300, heli: 800, tank: 1000, gunship: 3000,
  };

  // uccisione in catena: moltiplicatore arcade se i kill sono ravvicinati
  function comboKill(pts, x, y) {
    const c = G.combo;
    c.n = c.t > 0 ? c.n + 1 : 1;
    c.t = 2.2;
    const mult = 1 + Math.min(2, (c.n - 1) * 0.15);
    addScore(Math.round(pts * mult / 10) * 10, x, y);
    if (c.n >= 2) G.scorePops.push({ x: x, y: y - 18, label: 'CHAIN x' + c.n, t: 0 });
  }

  function spawnEnemy(type, x, opts) {
    opts = opts || {};
    const base = {
      type: type, x: x, y: opts.y !== undefined ? opts.y : Level.GROUND,
      vx: 0, vy: 0, facing: -1, hp: 1,
      state: 'patrol', t: rnd(0, 1), fireT: rnd(0.5, 1.5),
      animT: rnd(0, 4), runFrame: 0, spawnX: x, dead: false,
      flash: 0, burst: 0,
    };
    if (type === 'soldier') base.hp = 1;
    else if (type === 'grenadier') base.hp = 1;
    else if (type === 'knife') { base.hp = 1; }
    else if (type === 'bazooka') { base.hp = 2; base.fireT = rnd(1.0, 1.8); }
    else if (type === 'turret') { base.hp = 4; base.fireT = rnd(0.8, 1.4); }
    else if (type === 'heli') {
      base.hp = 10; base.y = 130; base.bobT = rnd(0, 6); base.fireT = 1.2;
      base.entering = true;
    } else if (type === 'gunship') {
      base.hp = 36; base.y = -60; base.bobT = 0; base.fireT = 1.6;
      base.bombT = 3.0; base.entering = true;
      SFX.alarm();
      if (G.mode === 'arcade') SFX.setIntensity(1);
    } else if (type === 'tank') {
      base.hp = 14; base.fireT = 1.6; base.tread = 0;
    }
    G.enemies.push(base);
    return base;
  }

  function enemyHitbox(e) {
    if (e.type === 'heli') return { x: e.x - 50, y: e.y - 24, w: 100, h: 48 };
    if (e.type === 'gunship') return { x: e.x - 78, y: e.y - 36, w: 156, h: 72 };
    if (e.type === 'tank') return { x: e.x - 52, y: e.y - 52, w: 104, h: 52 };
    return { x: e.x - 12, y: e.y - P_H, w: 24, h: P_H };
  }

  function damageEnemy(e, dmg, dir) {
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.hp <= 0) {
      killEnemy(e, dir || 1);
      comboKill(ENEMY_PTS[e.type] || 100, e.x, e.y - 60);
      G.hitStop = Math.max(G.hitStop, isInfantry(e.type) ? 0.04 : 0.07);
    } else if (e.type === 'heli' || e.type === 'tank' || e.type === 'gunship') {
      SFX.bossHit();
    }
  }

  function killEnemy(e, dir) {
    e.dead = true;
    if (isInfantry(e.type)) {
      SFX.enemyDie();
      bloodBurst(e.x, e.y - 30, 7);
      if (e.type === 'turret') {
        // i sacchi di sabbia si sbriciolano
        for (let i = 0; i < 10; i++) {
          G.particles.push({
            x: e.x + rnd(-26, 26), y: e.y - rnd(0, 26),
            vx: rnd(-140, 140), vy: rnd(-260, -80),
            t: 0, life: rnd(0.4, 0.8), color: '#b09a6a', size: rnd(3, 7), grav: 900,
          });
        }
      }
      G.corpses.push({
        spr: (e.type === 'bazooka' ? Sprites.elite : Sprites.enemy).idle,
        x: e.x, y: e.y - 10,
        vx: dir * rnd(120, 220), vy: rnd(-420, -300),
        angle: 0, spin: dir * rnd(5, 9), facing: e.facing, t: 0, life: 1.1,
      });
    } else if (e.type === 'heli' || e.type === 'gunship') {
      const big = e.type === 'gunship';
      if (big && G.mode === 'arcade') SFX.setIntensity(0); // fine allerta miniboss
      explode(e.x, e.y, big ? 100 : 70, false, true);
      G.corpses.push({
        heli: true, scale: big ? 1.6 : 1, x: e.x, y: e.y,
        vx: rnd(-60, 60), vy: 60,
        angle: 0, spin: rnd(3, 6), facing: e.facing, t: 0, life: 2.0,
      });
    } else if (e.type === 'tank') {
      explode(e.x, e.y - 26, 90, false, true);
      explode(e.x - 30, e.y - 10, 50, false, false);
      explode(e.x + 30, e.y - 40, 50, false, false);
    }
  }

  function updateEnemies(dt) {
    const p = G.player;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.t += dt;
      e.fireT -= dt;
      if (e.flash > 0) e.flash -= dt;
      const dx = p.x - e.x;
      const adx = Math.abs(dx);
      const ady = Math.abs((p.y - P_H / 2) - (e.y - P_H / 2));

      if (isInfantry(e.type)) {
        // gravità per la fanteria
        e.vy += GRAV * dt;
        e.y += e.vy * dt;
        if (e.y >= Level.GROUND) { e.y = Level.GROUND; e.vy = 0; }
      }

      switch (e.type) {
        case 'soldier': {
          const engaged = adx < 560 && ady < 160 && !p.dead;
          if (engaged) {
            e.facing = dx > 0 ? 1 : -1;
            if (adx > 380) { e.vx = e.facing * 90; }
            else e.vx = 0;
            if (e.burst > 0) {
              if (e.fireT <= 0) {
                fireEnemyBullet(e, 6);
                e.burst--;
                e.fireT = e.burst === 0 ? rnd(1.4, 2.2) : 0.14; // pausa dopo la raffica
              }
            } else if (e.fireT <= 0 && adx > 60) {
              e.burst = 3;
              e.fireT = 0.1;
            }
          } else {
            // pattuglia
            e.vx = Math.sin(e.t * 0.8) > 0 ? 40 : -40;
            e.facing = e.vx > 0 ? 1 : -1;
            if (Math.abs(e.x - e.spawnX) > 90) e.vx = (e.spawnX - e.x) > 0 ? 40 : -40;
          }
          e.x += e.vx * dt;
          break;
        }
        case 'grenadier': {
          const engaged = adx < 500 && !p.dead;
          e.facing = dx > 0 ? 1 : -1;
          if (engaged) {
            if (adx > 320) e.vx = e.facing * 70;
            else e.vx = 0;
            if (e.fireT <= 0 && adx > 90) {
              const ft = 0.6; // tempo di volo della granata (gravità 1700, vy -420)
              G.grenades.push({
                kind: 'egren', x: e.x + e.facing * 8, y: e.y - 44,
                vx: dx / ft + rnd(-40, 40), vy: -420, t: 99, bounced: false,
              });
              SFX.throwG();
              e.fireT = rnd(2.0, 2.8);
            }
          } else e.vx = 0;
          e.x += e.vx * dt;
          break;
        }
        case 'knife': {
          if (!p.dead && adx < 700) {
            e.facing = dx > 0 ? 1 : -1;
            e.vx = e.facing * 215;
          } else e.vx = 0;
          e.x += e.vx * dt;
          // contatto = morte del giocatore
          if (!p.dead && adx < 24 && ady < 50) killPlayer();
          break;
        }
        case 'bazooka': {
          // tiratore d'élite: mantiene la distanza e lancia razzi lenti
          e.facing = dx > 0 ? 1 : -1;
          if (!p.dead) {
            if (adx < 180) e.vx = -e.facing * 75;       // arretra
            else if (adx > 620) e.vx = e.facing * 60;   // avanza
            else e.vx = 0;
            if (e.fireT <= 0 && adx >= 150 && adx < 700) {
              const ang = Math.atan2((p.y - 30) - (e.y - 34), dx);
              G.grenades.push({
                kind: 'erkt', x: e.x + e.facing * 18, y: e.y - 34,
                vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330, fuse: 2.4,
              });
              SFX.rocket();
              muzzleBlast(e.x + e.facing * 22, e.y - 34, 4);
              e.fireT = rnd(2.6, 3.6);
            }
          } else e.vx = 0;
          e.x += e.vx * dt;
          break;
        }
        case 'turret': {
          // postazione fissa: raffiche lunghe dietro i sacchi di sabbia
          e.facing = dx > 0 ? 1 : -1;
          if (adx < 640 && !p.dead) {
            if (e.burst > 0) {
              if (e.fireT <= 0) {
                fireEnemyBullet(e, 9);
                e.burst--;
                e.fireT = e.burst === 0 ? rnd(1.8, 2.6) : 0.12;
              }
            } else if (e.fireT <= 0 && adx > 50) {
              e.burst = 5;
              e.fireT = 0.1;
            }
          }
          break;
        }
        case 'gunship': {
          // miniboss volante: ventagli di proiettili + passaggi di bombardamento
          e.bobT += dt;
          if (e.entering) {
            e.y += (170 - e.y) * Math.min(1, dt * 1.5);
            if (Math.abs(e.y - 170) < 6) e.entering = false;
          }
          const targetX = p.x + Math.sin(e.t * 0.45) * 260;
          const targetY = 170 + Math.sin(e.bobT * 1.8) * 30;
          e.x += clamp(targetX - e.x, -170, 170) * dt;
          e.y += clamp(targetY - e.y, -80, 80) * dt;
          e.facing = dx > 0 ? 1 : -1;
          e.bombT -= dt;
          if (!p.dead && !e.entering) {
            if (e.fireT <= 0) {
              // ventaglio di 3 proiettili
              for (let i = -1; i <= 1; i++) {
                const ang = Math.atan2((p.y - 28) - e.y, dx) + i * 0.18;
                G.eBullets.push({
                  x: e.x, y: e.y + 18,
                  vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360, life: 2.6,
                });
              }
              SFX.mg();
              muzzleBlast(e.x - e.facing * 40, e.y + 14, 4);
              e.fireT = rnd(1.4, 2.0);
            }
            if (e.bombT <= 0 && adx < 220) {
              G.grenades.push({ kind: 'bomb', x: e.x, y: e.y + 30, vx: 0, vy: 80, t: 99 });
              G.grenades.push({ kind: 'bomb', x: e.x + e.facing * 50, y: e.y + 30, vx: e.facing * 40, vy: 60, t: 99 });
              SFX.heliBomb();
              e.bombT = rnd(3.2, 4.2);
            }
          }
          break;
        }
        case 'heli': {
          e.bobT += dt;
          const targetX = p.x + Math.sin(e.t * 0.6) * 180;
          const targetY = 150 + Math.sin(e.bobT * 2) * 22;
          e.x += clamp(targetX - e.x, -130, 130) * dt;
          e.y += clamp(targetY - e.y, -70, 70) * dt;
          e.facing = dx > 0 ? 1 : -1;
          if (e.fireT <= 0 && !p.dead) {
            if (Math.random() < 0.55 && adx < 140) {
              // bomba in caduta
              G.grenades.push({ kind: 'bomb', x: e.x, y: e.y + 24, vx: e.vx * 0.2, vy: 60, t: 99 });
              SFX.heliBomb();
            } else {
              fireEnemyBullet(e, 10, e.x - e.facing * 0, e.y + 10);
            }
            e.fireT = rnd(1.6, 2.4);
          }
          break;
        }
        case 'tank': {
          e.facing = dx > 0 ? 1 : -1;
          if (adx > 460) { e.vx = e.facing * 55; e.tread += dt * 40; }
          else e.vx = 0;
          e.x += e.vx * dt;
          if (e.fireT <= 0 && !p.dead && adx < 760) {
            const ft = 1.1; // tempo di volo del colpo (gravità 900, vy -480)
            G.grenades.push({
              kind: 'shell', x: e.x + e.facing * 70, y: e.y - 44,
              vx: (dx + rnd(-50, 50)) / ft, vy: -480, t: 99,
            });
            SFX.tankShot();
            muzzleBlast(e.x + e.facing * 74, e.y - 44);
            e.fireT = rnd(2.6, 3.4);
          }
          // schiaccia il giocatore
          if (!p.dead && adx < 56 && p.y > e.y - 56) killPlayer();
          break;
        }
      }

      // animazione corsa fanteria
      if (isInfantry(e.type)) {
        if (Math.abs(e.vx) > 5) {
          e.animT += dt * (e.type === 'knife' ? 14 : 8);
          e.runFrame = Math.floor(e.animT) % 4;
        } else e.runFrame = 0;
      }
    }
    // rimuovi i morti
    G.enemies = G.enemies.filter(e => !e.dead);
  }

  function fireEnemyBullet(e, spread, fx, fy) {
    const p = G.player;
    const sx = fx !== undefined ? fx : e.x + e.facing * 22;
    const sy = fy !== undefined ? fy : e.y - 30;
    const tx = p.x, ty = p.y - (p.crouch ? 18 : 30);
    let ang = Math.atan2(ty - sy, tx - sx);
    ang += rnd(-spread, spread) * 0.012;
    const sp = 340;
    G.eBullets.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 2.6 });
    SFX.pistol();
    muzzleBlast(sx, sy, 2);
  }

  // scintille metalliche nel punto d'impatto
  function hitSparks(x, y, dir) {
    for (let i = 0; i < 4; i++) {
      G.particles.push({
        x: x, y: y, vx: -dir * rnd(40, 200) + rnd(-50, 50), vy: rnd(-160, 40),
        t: 0, life: rnd(0.1, 0.25), color: Math.random() < 0.5 ? '#fff4c0' : '#ffae42',
        size: rnd(2, 4), grav: 600,
      });
    }
  }

  function muzzleBlast(x, y, n) {
    n = n || 5;
    for (let i = 0; i < n; i++) {
      G.particles.push({
        x: x, y: y, vx: rnd(-90, 90), vy: rnd(-90, 90),
        t: 0, life: 0.1, color: '#ffd76a', size: rnd(2, 6), grav: 0,
      });
    }
  }

  function drawEnemies(g, camX) {
    for (const e of G.enemies) {
      const sx = e.x - camX;
      if (sx < -180 || sx > 960 + 180) continue;
      if (isInfantry(e.type)) {
        const S = e.type === 'bazooka' ? Sprites.elite : Sprites.enemy;
        let spr;
        if (e.type === 'turret') spr = S.crouch;
        else if (Math.abs(e.vx) > 5) spr = S.run[e.runFrame];
        else spr = S.idle;
        Sprites.draw(g, spr, sx, e.y, e.facing, 1, e.flash > 0);
        if (e.type === 'turret') Sprites.drawSandbags(g, sx + e.facing * 20, e.y);
      } else if (e.type === 'heli') {
        Sprites.drawHeli(g, sx, e.y, e.facing, e.t, e.flash > 0);
      } else if (e.type === 'gunship') {
        g.save();
        g.translate(sx, e.y);
        g.scale(1.6, 1.6);
        Sprites.drawHeli(g, 0, 0, e.facing, e.t, e.flash > 0);
        g.restore();
        // mini barra HP del miniboss
        g.fillStyle = '#000';
        g.fillRect(sx - 42, e.y - 62, 84, 8);
        g.fillStyle = '#e83a2a';
        g.fillRect(sx - 40, e.y - 60, 80 * Math.max(0, e.hp / 36), 4);
      } else if (e.type === 'tank') {
        Sprites.drawTank(g, sx, e.y, e.facing, e.tread * 10, e.flash > 0);
      }
    }
  }

  // ============================================================
  // BOSS — fortezza corazzata
  // ============================================================
  function spawnBoss() {
    G.boss = {
      x: Level.W + 150, y: Level.GROUND, hp: 70, maxHp: 70,
      state: 'enter', t: 0, fireT: 2.0, mgT: 4.0, spawnT: 6.0,
      flash: 0, tread: 0, recoil: 0, dieT: 0, minions: 0,
      mgBurst: 0, mgShotT: 0,
    };
  }

  function bossHitbox(b) {
    return { x: b.x - 105, y: b.y - 130, w: 210, h: 130 };
  }

  function updateBoss(dt) {
    const b = G.boss;
    if (!b) return;
    const p = G.player;
    b.t += dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.recoil > 0) b.recoil -= dt * 60;

    if (b.state === 'enter') {
      b.x -= 90 * dt;
      b.tread += dt * 60;
      if (b.x <= Level.BOSS_X) { b.x = Level.BOSS_X; b.state = 'fight'; }
      return;
    }

    if (b.state === 'die') {
      b.dieT += dt;
      if (Math.random() < 0.25) {
        explode(b.x + rnd(-100, 100), b.y - rnd(0, 120), rnd(40, 70), false, Math.random() < 0.3);
      }
      if (b.dieT > 2.6) {
        explode(b.x, b.y - 60, 140, false, true);
        explode(b.x - 70, b.y - 30, 90, false, true);
        explode(b.x + 70, b.y - 90, 90, false, true);
        G.boss = null;
        G.victory();
      }
      return;
    }

    // --- combattimento ---
    const enraged = b.hp < b.maxHp * 0.35;
    const mul = enraged ? 0.62 : 1;
    b.fireT -= dt; b.mgT -= dt; b.spawnT -= dt;

    // colpi di cannone ad arco (3 proiettili)
    if (b.fireT <= 0 && !p.dead) {
      for (let i = 0; i < 3; i++) {
        const dx = (p.x + rnd(-90, 90)) - b.x;
        const ft = 1.25 + i * 0.08; // sincronizzato con gravità 900 e vy crescente
        G.grenades.push({
          kind: 'shell', x: b.x - 130, y: b.y - 102,
          vx: dx / ft, vy: -480 - i * 40, t: 99,
        });
      }
      SFX.tankShot();
      muzzleBlast(b.x - 140, b.y - 100, 9);
      b.recoil = 16;
      G.shake = Math.max(G.shake, 5);
      b.fireT = 3.4 * mul;
    }

    // raffica di mitragliatrice (timer interno, sicuro con pausa e hit-stop)
    if (b.mgT <= 0 && !p.dead) {
      b.mgBurst = enraged ? 8 : 5;
      b.mgShotT = 0;
      b.mgT = 5.2 * mul;
    }
    if (b.mgBurst > 0) {
      b.mgShotT -= dt;
      if (b.mgShotT <= 0 && !p.dead) {
        fireEnemyBullet(b, 14, b.x - 115, b.y - 58);
        b.mgBurst--;
        b.mgShotT = 0.11;
      }
    }

    // rinforzi di fanteria
    if (b.spawnT <= 0 && b.minions < 3) {
      const e = spawnEnemy(Math.random() < 0.5 ? 'soldier' : 'knife', b.x - 130);
      e.fromBoss = true;
      b.minions++;
      b.spawnT = 7.5 * mul;
    }
    b.minions = G.enemies.filter(e => e.fromBoss && !e.dead).length;

    // contatto con i cingoli
    if (!p.dead && Math.abs(p.x - b.x) < 112 && p.y > b.y - 80) killPlayer();
  }

  function damageBoss(dmg) {
    const b = G.boss;
    if (!b || b.state !== 'fight') return;
    b.hp -= dmg;
    b.flash = 0.07;
    SFX.bossHit();
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = 'die';
      addScore(5000, b.x, b.y - 150);
      G.hitStop = Math.max(G.hitStop, 0.18);
      SFX.bigExplosion();
    }
  }

  function drawBossEntity(g, camX) {
    const b = G.boss;
    if (!b) return;
    Sprites.drawBoss(g, b.x - camX, b.y, -1, b.tread, b.flash > 0, Math.max(0, b.recoil));
  }

  // ============================================================
  // PROIETTILI
  // ============================================================
  function updateBullets(dt) {
    const p = G.player;

    // proiettili del giocatore
    for (const b of G.pBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.type === 'flame') {
        b.t += dt;
        b.vx *= 1 - 1.6 * dt; // la fiamma decelera e si allarga
        b.vy -= 50 * dt;
      }
      if (b.life <= 0 || Math.abs(b.x - (G.camX + 480)) > 1400) { b.dead = true; continue; }
      if (b.y >= Level.GROUND + 2 || b.y < -40) {
        if (b.type === 'rocket') explode(b.x, b.y, 85, false, false, true);
        b.dead = true; continue;
      }
      const r = b.type === 'flame' ? 6 + b.t * 26 : 4;
      // contro i nemici
      for (const e of G.enemies) {
        if (e.dead) continue;
        const hb = enemyHitbox(e);
        if (overlap(b.x - r, b.y - r, r * 2, r * 2, hb.x, hb.y, hb.w, hb.h)) {
          if (b.type === 'rocket') explode(b.x, b.y, 85, false, false, true);
          else {
            damageEnemy(e, b.dmg, b.vx >= 0 ? 1 : -1);
            hitSparks(b.x, b.y, b.vx >= 0 ? 1 : -1);
          }
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      // contro il boss
      if (G.boss && G.boss.state !== 'enter') {
        const hb = bossHitbox(G.boss);
        if (overlap(b.x - r, b.y - r, r * 2, r * 2, hb.x, hb.y, hb.w, hb.h)) {
          if (b.type === 'rocket') explode(b.x, b.y, 85, false, false, true);
          else {
            damageBoss(b.dmg);
            hitSparks(b.x, b.y, b.vx >= 0 ? 1 : -1);
          }
          b.dead = true;
        }
      }
    }
    G.pBullets = G.pBullets.filter(b => !b.dead);

    // proiettili nemici
    for (const b of G.eBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y >= Level.GROUND + 2) { b.dead = true; continue; }
      if (!p.dead && p.inv <= 0) {
        const hb = playerHitbox(p);
        if (overlap(b.x - 3, b.y - 3, 6, 6, hb.x, hb.y, hb.w, hb.h)) {
          killPlayer();
          b.dead = true;
        }
      }
    }
    G.eBullets = G.eBullets.filter(b => !b.dead);
  }

  function drawBullets(g, camX) {
    for (const b of G.pBullets) {
      const sx = b.x - camX;
      if (b.type === 'rocket') {
        g.save();
        g.translate(sx, b.y);
        g.rotate(Math.atan2(b.vy, b.vx));
        g.fillStyle = '#8a8a92';
        g.fillRect(-10, -4, 20, 8);
        g.fillStyle = '#c23b22';
        g.fillRect(6, -4, 4, 8);
        g.fillStyle = '#ffae42';
        g.fillRect(-16, -3, 6, 6);
        g.restore();
        // scia di fumo
        if (Math.random() < 0.6) {
          G.particles.push({
            x: b.x - b.vx * 0.02, y: b.y, vx: rnd(-20, 20), vy: rnd(-30, 0),
            t: 0, life: 0.4, color: '#999', size: rnd(3, 6), grav: -60,
          });
        }
      } else if (b.type === 'flame') {
        const r = 5 + b.t * 24;
        const k = b.t / 0.4;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.max(0, 0.85 - k * 0.6);
        g.fillStyle = k < 0.3 ? '#ffe28a' : k < 0.65 ? '#ffae42' : '#ff5a2a';
        g.beginPath();
        g.arc(sx + rnd(-2, 2), b.y + rnd(-2, 2), r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        g.fillStyle = '#ffe28a';
        g.save();
        g.translate(sx, b.y);
        g.rotate(Math.atan2(b.vy, b.vx));
        g.fillRect(-7, -2, 14, 4);
        g.restore();
      }
    }
    for (const b of G.eBullets) {
      const sx = b.x - camX;
      g.fillStyle = '#ff6a3a';
      g.beginPath();
      g.arc(sx, b.y, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffd0a0';
      g.beginPath();
      g.arc(sx, b.y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ============================================================
  // GRANATE / BOMBE / PROIETTILI BALISTICI
  // ============================================================
  function updateGrenades(dt) {
    const GRAV_BY_KIND = { pgren: 1700, egren: 1700, bomb: 1400, shell: 900, erkt: 0 };
    for (const gr of G.grenades) {
      gr.vy += GRAV_BY_KIND[gr.kind] * dt;
      gr.x += gr.vx * dt;
      gr.y += gr.vy * dt;

      // razzo nemico: vola dritto, scia di fumo, esplode a fine corsa
      if (gr.kind === 'erkt') {
        gr.fuse -= dt;
        if (Math.random() < 0.5) {
          G.particles.push({
            x: gr.x - gr.vx * 0.03, y: gr.y, vx: rnd(-15, 15), vy: rnd(-25, 5),
            t: 0, life: 0.35, color: '#999', size: rnd(3, 5), grav: -50,
          });
        }
        if (gr.fuse <= 0) {
          gr.dead = true;
          explode(gr.x, gr.y, 68, true, false, false);
          continue;
        }
      }

      if (gr.kind === 'pgren') {
        gr.t -= dt;
        if (gr.y >= Level.GROUND && gr.vy > 0) {
          if (!gr.bounced) {
            gr.y = Level.GROUND; gr.vy *= -0.45; gr.vx *= 0.6; gr.bounced = true;
            SFX.bounce();
          } else {
            gr.y = Level.GROUND;
            gr.dead = true;
            explode(gr.x, gr.y - 6, 80, false, false, true);
            continue;
          }
        }
        if (gr.t <= 0) {
          gr.dead = true;
          explode(gr.x, gr.y, 80, false, false, true);
          continue;
        }
        // esplode a contatto con i nemici
        for (const e of G.enemies) {
          if (e.dead) continue;
          const hb = enemyHitbox(e);
          if (overlap(gr.x - 5, gr.y - 5, 10, 10, hb.x, hb.y, hb.w, hb.h)) {
            gr.dead = true;
            explode(gr.x, gr.y, 80, false, false, true);
            break;
          }
        }
        if (!gr.dead && G.boss && G.boss.state === 'fight') {
          const hb = bossHitbox(G.boss);
          if (overlap(gr.x - 5, gr.y - 5, 10, 10, hb.x, hb.y, hb.w, hb.h)) {
            gr.dead = true;
            explode(gr.x, gr.y, 80, false, false, true);
          }
        }
      } else {
        // egren / bomb / shell / erkt: ostili, esplodono al suolo o sul giocatore
        if (gr.y >= Level.GROUND) {
          gr.dead = true;
          explode(gr.x, Level.GROUND - 6, gr.kind === 'shell' ? 80 : 72, true, false, false);
          continue;
        }
        const p = G.player;
        if (!p.dead && p.inv <= 0) {
          const hb = playerHitbox(p);
          if (overlap(gr.x - 6, gr.y - 6, 12, 12, hb.x, hb.y, hb.w, hb.h)) {
            gr.dead = true;
            explode(gr.x, gr.y, 72, true, false, false);
          }
        }
      }
    }
    G.grenades = G.grenades.filter(gr => !gr.dead);
  }

  function drawGrenades(g, camX) {
    for (const gr of G.grenades) {
      const sx = gr.x - camX;
      if (gr.kind === 'shell') {
        g.save();
        g.translate(sx, gr.y);
        g.rotate(Math.atan2(gr.vy, gr.vx));
        g.fillStyle = '#2e2c26';
        g.fillRect(-8, -5, 16, 10);
        g.fillStyle = '#55524a';
        g.fillRect(4, -5, 4, 10);
        g.restore();
      } else if (gr.kind === 'erkt') {
        g.save();
        g.translate(sx, gr.y);
        g.rotate(Math.atan2(gr.vy, gr.vx));
        g.fillStyle = '#6a6a72';
        g.fillRect(-10, -4, 20, 8);
        g.fillStyle = '#b03a2e';
        g.fillRect(6, -4, 4, 8);
        g.fillStyle = '#ffae42';
        g.fillRect(-15, -3, 5, 6);
        g.restore();
      } else if (gr.kind === 'bomb') {
        g.fillStyle = '#3a3e30';
        g.fillRect(sx - 5, gr.y - 9, 10, 18);
        g.fillStyle = '#5a5e48';
        g.fillRect(sx - 5, gr.y - 9, 10, 4);
      } else {
        g.fillStyle = gr.kind === 'pgren' ? '#3e5a28' : '#5e3a28';
        g.beginPath();
        g.arc(sx, gr.y, 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#222';
        g.fillRect(sx - 1, gr.y - 9, 3, 4);
      }
    }
  }

  // ============================================================
  // ESPLOSIONI E PARTICELLE
  // ============================================================
  function explode(x, y, r, hostileToPlayer, big, fromPlayer) {
    if (big) SFX.bigExplosion(); else SFX.explosion();
    G.shake = Math.max(G.shake, big ? 14 : 8);
    G.hitStop = Math.max(G.hitStop, big ? 0.06 : 0.025);
    G.flashes.push({ x: x, y: y, r: r, t: 0, life: 0.28 });

    const n = big ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(60, big ? 380 : 260);
      G.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        t: 0, life: rnd(0.25, 0.6),
        color: ['#ffdf6a', '#ffae42', '#ff6a3a', '#d8d8d8', '#777'][Math.floor(Math.random() * 5)],
        size: rnd(4, big ? 14 : 9), grav: 500,
      });
    }

    // danni ad area
    if (hostileToPlayer) {
      const p = G.player;
      if (!p.dead && p.inv <= 0) {
        const dx = p.x - x, dy = (p.y - 28) - y;
        if (dx * dx + dy * dy < r * r) killPlayer();
      }
    }
    if (fromPlayer) {
      for (const e of G.enemies) {
        if (e.dead) continue;
        const hb = enemyHitbox(e);
        const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
        const dx = cx - x, dy = cy - y;
        if (dx * dx + dy * dy < (r + 20) * (r + 20)) damageEnemy(e, 5, dx >= 0 ? 1 : -1);
      }
      if (G.boss && G.boss.state === 'fight') {
        const hb = bossHitbox(G.boss);
        const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
        const dx = cx - x, dy = cy - y;
        if (dx * dx + dy * dy < (r + 90) * (r + 90)) damageBoss(5);
      }
    }
  }

  function bloodBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      G.particles.push({
        x: x, y: y, vx: rnd(-160, 160), vy: rnd(-260, -60),
        t: 0, life: rnd(0.3, 0.6), color: '#b02020', size: rnd(2, 5), grav: 900,
      });
    }
  }

  function updateParticles(dt) {
    for (const pa of G.particles) {
      pa.t += dt;
      pa.vy += (pa.grav || 0) * dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.y > Level.GROUND && pa.vy > 0) { pa.y = Level.GROUND; pa.vy *= -0.3; pa.vx *= 0.7; }
    }
    G.particles = G.particles.filter(pa => pa.t < pa.life);
    // tetto per evitare picchi di GC nelle scene più caotiche
    if (G.particles.length > 450) G.particles.splice(0, G.particles.length - 450);

    for (const f of G.flashes) f.t += dt;
    G.flashes = G.flashes.filter(f => f.t < f.life);

    for (const c of G.corpses) {
      c.t += dt;
      c.vy += GRAV * 0.7 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
      if (c.y > Level.GROUND + (c.heli ? -10 : 6)) {
        c.y = Level.GROUND + (c.heli ? -10 : 6);
        c.vy = 0; c.vx *= 0.7; c.spin *= 0.5;
        if (c.heli && !c.boomed) {
          c.boomed = true;
          explode(c.x, c.y, 90, false, true);
          c.life = Math.min(c.life, c.t + 0.1);
        }
      }
    }
    G.corpses = G.corpses.filter(c => c.t < c.life);
  }

  function drawParticles(g, camX) {
    for (const f of G.flashes) {
      const k = f.t / f.life;
      g.save();
      g.globalAlpha = 1 - k;
      g.fillStyle = k < 0.4 ? '#fff4c0' : '#ffae42';
      g.beginPath();
      g.arc(f.x - camX, f.y, f.r * (0.4 + k * 0.8), 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    for (const pa of G.particles) {
      g.save();
      g.globalAlpha = Math.max(0, 1 - pa.t / pa.life);
      g.fillStyle = pa.color;
      g.fillRect(pa.x - camX - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
      g.restore();
    }
    for (const c of G.corpses) {
      if (c.heli) {
        g.save();
        g.globalAlpha = Math.max(0, 1 - c.t / c.life * 0.6);
        g.translate(c.x - camX, c.y);
        g.rotate(c.angle * 0.3);
        if (c.scale && c.scale !== 1) g.scale(c.scale, c.scale);
        Sprites.drawHeli(g, 0, 0, c.facing, c.t, false);
        g.restore();
      } else {
        Sprites.drawRotated(g, c.spr, c.x - camX, c.y, c.facing, c.angle, 1 - c.t / c.life);
      }
    }
  }

  // ============================================================
  // POW E PICKUP
  // ============================================================
  function spawnPow(x) {
    G.pows.push({ x: x, y: Level.GROUND, state: 'tied', t: 0, facing: -1 });
  }

  function updatePows(dt) {
    const p = G.player;
    for (const w of G.pows) {
      w.t += dt;
      if (w.state === 'tied') {
        if (!p.dead && Math.abs(p.x - w.x) < 30 && Math.abs(p.y - w.y) < 60) {
          w.state = 'free'; w.t = 0;
          SFX.pow();
          addScore(500, w.x, w.y - 70);
          // regalo: arma o granate
          const gifts = ['mg', 'spread', 'rocket', 'flame', 'grenades'];
          spawnPickup(w.x + 30, gifts[Math.floor(Math.random() * gifts.length)]);
        }
      } else {
        // saluta e scappa
        if (w.t > 1.2) { w.x -= 140 * dt; w.facing = -1; }
        if (w.t > 5) w.dead = true;
      }
    }
    G.pows = G.pows.filter(w => !w.dead);
  }

  function drawPows(g, camX) {
    for (const w of G.pows) {
      const sx = w.x - camX;
      if (sx < -80 || sx > 1040) continue;
      const spr = w.state === 'tied' ? Sprites.powTied : Sprites.powFree;
      const bounce = w.state === 'free' && w.t < 1.2 ? Math.abs(Math.sin(w.t * 8)) * 8 : 0;
      Sprites.draw(g, spr, sx, w.y - bounce, w.facing);
      if (w.state === 'tied') {
        // "HELP!" lampeggiante
        if (Math.floor(w.t * 2) % 2 === 0) {
          g.fillStyle = '#fff';
          g.font = 'bold 11px "Courier New", monospace';
          g.textAlign = 'center';
          g.fillText('HELP!', sx, w.y - 48);
        }
      }
    }
  }

  function spawnPickup(x, type) {
    G.pickups.push({ x: x, y: Level.GROUND - 200, vy: 0, type: type, t: 0, landed: false });
  }

  const PICKUP_INFO = {
    mg: { letter: 'H', color: '#ffd76a' },
    spread: { letter: 'S', color: '#7ad0ff' },
    rocket: { letter: 'R', color: '#ff8a6a' },
    flame: { letter: 'F', color: '#ff7a2a' },
    grenades: { letter: 'G', color: '#9aff8a' },
  };

  function updatePickups(dt) {
    const p = G.player;
    for (const pk of G.pickups) {
      pk.t += dt;
      if (!pk.landed) {
        pk.vy += 1200 * dt;
        pk.y += pk.vy * dt;
        if (pk.y >= Level.GROUND) { pk.y = Level.GROUND; pk.landed = true; }
      }
      if (pk.t > 14) pk.dead = true;
      if (!p.dead && Math.abs(p.x - pk.x) < 28 && Math.abs((p.y - 24) - (pk.y - 14)) < 44) {
        pk.dead = true;
        SFX.pickup();
        if (pk.type === 'grenades') {
          p.grenades = Math.min(99, p.grenades + 6);
          addScore(200, pk.x, pk.y - 50);
        } else {
          p.weapon = pk.type;
          p.ammo = WEAPONS[pk.type].ammo;
          addScore(200, pk.x, pk.y - 50);
        }
      }
    }
    G.pickups = G.pickups.filter(pk => !pk.dead);
  }

  function drawPickups(g, camX) {
    for (const pk of G.pickups) {
      if (pk.t > 10 && Math.floor(pk.t * 8) % 2 === 0) continue; // lampeggio prima di sparire
      const info = PICKUP_INFO[pk.type];
      const bob = pk.landed ? Math.sin(pk.t * 4) * 3 : 0;
      Sprites.drawCrate(g, pk.x - camX, pk.y - bob, info.letter, info.color);
    }
  }

  // ============================================================
  // PUNTEGGIO FLUTTUANTE
  // ============================================================
  function addScore(pts, x, y) {
    G.score += pts;
    G.scorePops.push({ x: x, y: y, pts: pts, t: 0 });
  }

  function updateScorePops(dt) {
    for (const s of G.scorePops) { s.t += dt; s.y -= 40 * dt; }
    G.scorePops = G.scorePops.filter(s => s.t < 0.9);
  }

  function drawScorePops(g, camX) {
    for (const s of G.scorePops) {
      g.save();
      g.globalAlpha = 1 - s.t / 0.9;
      g.fillStyle = s.label ? '#7ad0ff' : '#ffe28a';
      g.font = 'bold 14px "Courier New", monospace';
      g.textAlign = 'center';
      g.fillText(s.label || ('+' + s.pts), s.x - camX, s.y);
      g.restore();
    }
  }

  window.Entities = {
    WEAPONS: WEAPONS,
    createPlayer: createPlayer,
    updatePlayer: updatePlayer,
    drawPlayer: drawPlayer,
    killPlayer: killPlayer,
    spawnEnemy: spawnEnemy,
    updateEnemies: updateEnemies,
    drawEnemies: drawEnemies,
    spawnBoss: spawnBoss,
    updateBoss: updateBoss,
    drawBoss: drawBossEntity,
    updateBullets: updateBullets,
    drawBullets: drawBullets,
    updateGrenades: updateGrenades,
    drawGrenades: drawGrenades,
    updateParticles: updateParticles,
    drawParticles: drawParticles,
    spawnPow: spawnPow,
    updatePows: updatePows,
    drawPows: drawPows,
    spawnPickup: spawnPickup,
    updatePickups: updatePickups,
    drawPickups: drawPickups,
    updateScorePops: updateScorePops,
    drawScorePops: drawScorePops,
    explode: explode,
    addScore: addScore,
  };
})();
