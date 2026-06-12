// ============================================================
// SETTINGS — pannello impostazioni (audio, comandi, gameplay)
// Sovrapposizione modale richiamabile dal menu o dalla pausa.
// ============================================================
(function () {
  let open = false;
  let backTo = 'menu';        // 'menu' o 'pause'
  let cursor = 0;
  let toastMsg = null;
  let toastT = 0;

  const items = [];

  function isFocusable(it) { return it && it.kind !== 'header'; }

  function rebuild() {
    items.length = 0;
    items.push({ kind: 'header', label: 'AUDIO' });
    items.push({ kind: 'slider', label: 'MASTER VOLUME',
      get: () => SFX.getMaster(), set: (v) => SFX.setMaster(v) });
    items.push({ kind: 'slider', label: 'SFX VOLUME',
      get: () => SFX.getSfx(), set: (v) => { SFX.setSfx(v); } });
    items.push({ kind: 'slider', label: 'MUSIC VOLUME',
      get: () => SFX.getMusic(), set: (v) => SFX.setMusic(v) });
    items.push({ kind: 'toggle', label: 'MUTE ALL',
      get: () => SFX.isMuted(),
      set: (v) => { if (v !== SFX.isMuted()) SFX.toggleMute(); } });
    items.push({ kind: 'toggle', label: 'MUSIC ENABLED',
      get: () => SFX.isMusicOn(),
      set: (v) => { if (v !== SFX.isMusicOn()) SFX.toggleMusic(); } });

    items.push({ kind: 'header', label: 'COMMANDS' });
    for (const a of Input.ACTIONS) {
      items.push({ kind: 'binding', action: a, label: Input.ACTION_LABELS[a] });
    }
    items.push({ kind: 'action', label: 'RESET TO DEFAULT KEYS', run: () => {
      Input.resetBindings();
      flash('Comandi ripristinati');
    } });

    items.push({ kind: 'header', label: 'GAMEPLAY' });
    items.push({ kind: 'toggle', label: 'GOD MODE (DEV)',
      get: () => !!window.G && !!G.godMode,
      set: (v) => {
        if (window.G) G.godMode = !!v;
        flash(v ? 'GOD MODE: ON' : 'GOD MODE: OFF');
      } });

    items.push({ kind: 'action', label: 'BACK', run: close });
  }

  function moveCursor(dir) {
    if (!items.length) return;
    let i = cursor;
    for (let k = 0; k < items.length; k++) {
      i = (i + dir + items.length) % items.length;
      if (isFocusable(items[i])) { cursor = i; SFX.bounce(); return; }
    }
  }

  function ensureFocus() {
    if (!isFocusable(items[cursor])) {
      for (let i = 0; i < items.length; i++) {
        if (isFocusable(items[i])) { cursor = i; return; }
      }
    }
  }

  function flash(msg) { toastMsg = msg; toastT = 1.6; }

  function openPanel(back) {
    rebuild();
    open = true;
    backTo = back || 'menu';
    cursor = 0;
    ensureFocus();
    toastT = 0;
  }
  function close() {
    open = false;
    if (Input.isCapturing()) Input.cancelCapture();
  }

  function update(dt) {
    if (!open) return;
    if (toastT > 0) toastT -= dt;
    if (Input.isCapturing()) return; // l'input è dirottato verso il rebinding

    if (Input.pressed('Escape')) { close(); return; }

    if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) moveCursor(1);
    if (Input.pressed('ArrowUp')   || Input.pressed('KeyW')) moveCursor(-1);

    const it = items[cursor];
    if (!it) return;

    if (it.kind === 'slider') {
      let v = it.get(), nv = v;
      if (Input.down('ArrowLeft')  || Input.down('KeyA')) nv -= dt;
      if (Input.down('ArrowRight') || Input.down('KeyD')) nv += dt;
      if (nv !== v) {
        nv = Math.max(0, Math.min(1, nv));
        it.set(nv);
        // beep di feedback ogni ~10%
        if (Math.floor(nv * 10) !== Math.floor(v * 10)) SFX.blip();
      }
    } else if (it.kind === 'toggle') {
      if (Input.pressed('Enter') || Input.pressed('Space') ||
          Input.pressed('ArrowLeft') || Input.pressed('ArrowRight')) {
        it.set(!it.get());
        SFX.bounce();
      }
    } else if (it.kind === 'binding') {
      if (Input.pressed('Enter') || Input.pressed('Space')) {
        startCapture(it.action, 0);
      } else if (Input.pressed('Tab')) {
        startCapture(it.action, 1);
      } else if (Input.pressed('Backspace') || Input.pressed('Delete')) {
        Input.setBinding(it.action, 1, null);
        flash('Slot 2 rimosso');
      }
    } else if (it.kind === 'action') {
      if (Input.pressed('Enter') || Input.pressed('Space')) it.run();
    }
  }

  function startCapture(action, slot) {
    Input.captureNext((code) => {
      if (code) {
        Input.setBinding(action, slot, code);
        flash('Tasto assegnato: ' + Input.label(code));
      } else {
        flash('Annullato');
      }
    });
  }

  // ----- rendering -----
  function txt(g, str, x, y, size, color, align) {
    g.font = 'bold ' + size + 'px "Courier New", monospace';
    g.textAlign = align || 'left';
    g.fillStyle = '#000';
    g.fillText(str, x + 2, y + 2);
    g.fillStyle = color || '#fff';
    g.fillText(str, x, y);
  }

  function draw(g, VW, VH) {
    if (!open) return;
    // sfondo opaco
    g.fillStyle = 'rgba(6,6,12,0.86)';
    g.fillRect(0, 0, VW, VH);
    // cornice
    g.strokeStyle = '#caa86a';
    g.lineWidth = 2;
    g.strokeRect(40, 30, VW - 80, VH - 60);

    txt(g, 'SETTINGS', VW / 2, 70, 32, '#ffae42', 'center');
    txt(g, 'Frecce muovi  \u00b7  Invio agisci  \u00b7  Tab slot 2  \u00b7  Backspace pulisce  \u00b7  ESC indietro',
        VW / 2, 96, 11, '#aaa', 'center');

    let y = 130;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'header') {
        y += 8;
        txt(g, '\u2014 ' + it.label + ' \u2014', VW / 2, y, 16, '#caa86a', 'center');
        y += 24;
        continue;
      }
      const sel = (i === cursor);
      const lbl = (sel ? '> ' : '  ') + it.label;
      txt(g, lbl, 110, y, 16, sel ? '#fff' : '#aaa');

      if (it.kind === 'slider') {
        const v = it.get();
        const bw = 240, bx = 460;
        g.fillStyle = '#000'; g.fillRect(bx, y - 12, bw, 14);
        g.fillStyle = sel ? '#7ad0ff' : '#5a90b0';
        g.fillRect(bx + 2, y - 10, (bw - 4) * v, 10);
        txt(g, Math.round(v * 100) + '%', bx + bw + 50, y, 14, sel ? '#fff' : '#aaa', 'right');
      } else if (it.kind === 'toggle') {
        const v = !!it.get();
        txt(g, v ? 'ON' : 'OFF', 720, y, 16, v ? '#9aff8a' : '#888');
      } else if (it.kind === 'binding') {
        const codes = Input.bindings()[it.action] || [];
        const cap = Input.isCapturing();
        const s1 = Input.label(codes[0]);
        const s2 = Input.label(codes[1]);
        txt(g, s1, 460, y, 16, sel ? '#ffe28a' : '#caa86a');
        txt(g, s2, 620, y, 16, sel ? '#ffe28a' : '#7a6a4a');
        if (sel && !cap) txt(g, '[Tab=2  Bksp=clear]', 720, y, 11, '#777');
      }
      y += 26;
    }

    if (toastMsg && toastT > 0) {
      g.save();
      g.globalAlpha = Math.min(1, toastT * 1.5);
      txt(g, toastMsg, VW / 2, VH - 50, 15, '#9aff8a', 'center');
      g.restore();
    }

    if (Input.isCapturing()) {
      g.fillStyle = 'rgba(0,0,0,0.78)';
      g.fillRect(VW / 2 - 220, VH / 2 - 60, 440, 120);
      g.strokeStyle = '#ffae42';
      g.strokeRect(VW / 2 - 220, VH / 2 - 60, 440, 120);
      txt(g, 'PREMI UN TASTO...', VW / 2, VH / 2 - 12, 22, '#fff', 'center');
      txt(g, 'ESC per annullare', VW / 2, VH / 2 + 22, 13, '#aaa', 'center');
    }
  }

  window.Settings = {
    open: openPanel,
    close: close,
    isOpen: () => open,
    update: update,
    draw: draw,
    flash: flash,
  };
})();
