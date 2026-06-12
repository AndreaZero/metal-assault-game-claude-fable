// ============================================================
// INPUT — tastiera con rilevamento "appena premuto"
// ============================================================
(function () {
  const down = {};
  const pressed = {};

  const PREVENT = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab',
  ]);

  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!down[e.code]) pressed[e.code] = true;
    down[e.code] = true;
    if (window.SFX) SFX.unlock();
  });
  window.addEventListener('keyup', (e) => {
    down[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in down) down[k] = false;
  });

  window.Input = {
    down(code) { return !!down[code]; },
    pressed(code) { return !!pressed[code]; },
    // combinazioni logiche di gioco
    left() { return this.down('ArrowLeft') || this.down('KeyA'); },
    right() { return this.down('ArrowRight') || this.down('KeyD'); },
    up() { return this.down('ArrowUp') || this.down('KeyW'); },
    downDir() { return this.down('ArrowDown') || this.down('KeyS'); },
    jump() { return this.pressed('Space') || this.pressed('KeyK'); },
    jumpHeld() { return this.down('Space') || this.down('KeyK'); },
    fire() { return this.down('KeyJ') || this.down('KeyZ'); },
    firePressed() { return this.pressed('KeyJ') || this.pressed('KeyZ'); },
    grenade() { return this.pressed('KeyL') || this.pressed('KeyX'); },
    start() { return this.pressed('Enter'); },
    endFrame() { for (const k in pressed) pressed[k] = false; },
  };
})();
