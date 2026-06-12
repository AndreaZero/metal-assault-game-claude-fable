// ============================================================
// INPUT — tastiera con bindings rebindabili + capture
// ============================================================
(function () {
  const down = {};
  const pressed = {};

  // azioni di gioco rebindabili (2 slot ciascuna: primario/secondario)
  const DEFAULTS = {
    left:    ['ArrowLeft',  'KeyA'],
    right:   ['ArrowRight', 'KeyD'],
    up:      ['ArrowUp',    'KeyW'],
    down:    ['ArrowDown',  'KeyS'],
    jump:    ['Space',      'KeyK'],
    fire:    ['KeyJ',       'KeyZ'],
    grenade: ['KeyL',       'KeyX'],
  };

  function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }

  let bindings = cloneDefaults();
  try {
    const saved = localStorage.getItem('ma_bindings');
    if (saved) {
      const parsed = JSON.parse(saved);
      for (const k in DEFAULTS) {
        if (parsed[k] && Array.isArray(parsed[k])) bindings[k] = parsed[k].slice(0, 2);
      }
    }
  } catch (e) {}

  function save() {
    try { localStorage.setItem('ma_bindings', JSON.stringify(bindings)); } catch (e) {}
  }

  // tasti di sistema su cui chiamiamo preventDefault per non fare scrollare la pagina
  const SYS_PREVENT = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Space', 'Tab', 'F1', 'F3', 'F5',
  ]);

  // capture: la prossima pressione viene catturata e inviata al callback
  let captureCb = null;

  window.addEventListener('keydown', (e) => {
    if (captureCb) {
      e.preventDefault();
      if (e.repeat) return; // ignora la ripetizione automatica del tasto che ha attivato il capture
      const cb = captureCb;
      captureCb = null;
      cb(e.code === 'Escape' ? null : e.code);
      return;
    }
    if (SYS_PREVENT.has(e.code) || isBound(e.code)) e.preventDefault();
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

  function isBound(code) {
    for (const a in bindings) {
      const list = bindings[a];
      for (const c of list) if (c === code) return true;
    }
    return false;
  }

  function anyDown(action) {
    const codes = bindings[action];
    if (!codes) return false;
    for (const c of codes) if (c && down[c]) return true;
    return false;
  }
  function anyPressed(action) {
    const codes = bindings[action];
    if (!codes) return false;
    for (const c of codes) if (c && pressed[c]) return true;
    return false;
  }

  // etichette user-friendly per il pannello impostazioni
  const LABELS = {
    ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193',
    Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', Tab: 'TAB', Backspace: 'BKSP',
    ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT',
    ControlLeft: 'L CTRL', ControlRight: 'R CTRL',
    AltLeft: 'L ALT', AltRight: 'R ALT',
    Slash: '/', Backslash: '\\', Period: '.', Comma: ',',
    Semicolon: ';', Quote: '\'', Backquote: '`',
    BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
  };
  function label(code) {
    if (!code) return '---';
    if (LABELS[code]) return LABELS[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NP ' + code.slice(6);
    if (code.startsWith('F') && /^F\d+$/.test(code)) return code;
    return code.toUpperCase();
  }

  window.Input = {
    down(code) { return !!down[code]; },
    pressed(code) { return !!pressed[code]; },
    // azioni di gioco
    left()        { return anyDown('left'); },
    right()       { return anyDown('right'); },
    up()          { return anyDown('up'); },
    downDir()     { return anyDown('down'); },
    jump()        { return anyPressed('jump'); },
    jumpHeld()    { return anyDown('jump'); },
    fire()        { return anyDown('fire'); },
    firePressed() { return anyPressed('fire'); },
    grenade()     { return anyPressed('grenade'); },
    // navigazione UI hardcoded (sempre disponibile)
    start()       { return !!pressed['Enter']; },
    endFrame()    { for (const k in pressed) pressed[k] = false; },
    // configurazione
    bindings()    { return bindings; },
    setBinding(action, slot, code) {
      if (!bindings[action]) return;
      bindings[action][slot] = code;
      save();
    },
    resetBindings() {
      bindings = cloneDefaults();
      save();
    },
    captureNext(cb) { captureCb = cb; },
    isCapturing()   { return !!captureCb; },
    cancelCapture() { captureCb = null; },
    label,
    DEFAULTS,
    ACTIONS: ['left', 'right', 'up', 'down', 'jump', 'fire', 'grenade'],
    ACTION_LABELS: {
      left:    'MOVE LEFT',
      right:   'MOVE RIGHT',
      up:      'AIM UP',
      down:    'CROUCH / DROP',
      jump:    'JUMP',
      fire:    'FIRE',
      grenade: 'GRENADE / CANNON',
    },
  };
})();
