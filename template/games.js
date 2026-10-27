(() => {
  window.Games = window.Games || {};

  let activeGame = null;
  let isPaused   = false;

  const picker      = document.getElementById('game-picker');
  const viewport    = document.getElementById('game-viewport');
  const canvas      = document.getElementById('game-canvas');
  const backBtn     = document.getElementById('game-back');
  const pauseBtn    = document.getElementById('game-pause');
  const ctrlDpad    = document.getElementById('ctrl-dpad');
  const ctrlShooter = document.getElementById('ctrl-shooter');
  const orientHint  = document.getElementById('orient-hint');
  const loginHint   = document.getElementById('game-login-hint');

  const DPAD_GAMES    = ['tetris', 'snake', 'pacman'];
  const SHOOTER_GAMES = ['spaceinvaders'];
  const isTouch       = 'ontouchstart' in window;

  // ─── High score save ────────────────────────────────────────────────────────
  const HI_KEYS = { tetris: 'tetris-hi', pacman: 'pacman-hi', snake: 'snake-hi', breakout: 'breakout-hi', spaceinvaders: 'si-hi' };

  function loadHighScores() {
    // Try site-config.json first, fall back to localStorage
    fetch('site-config.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(cfg => {
        const hs = cfg.highScores || {};
        document.querySelectorAll('.game-tile').forEach(btn => {
          const name = btn.dataset.game;
          const val  = hs[name] || parseInt(localStorage.getItem(HI_KEYS[name]) || '0');
          renderTileScore(btn, val);
        });
      })
      .catch(() => {
        document.querySelectorAll('.game-tile').forEach(btn => {
          const name = btn.dataset.game;
          const val  = parseInt(localStorage.getItem(HI_KEYS[name]) || '0');
          renderTileScore(btn, val);
        });
      });
  }

  function renderTileScore(btn, val) {
    let el = btn.querySelector('.tile-score');
    if (!el) {
      el = document.createElement('span');
      el.className = 'tile-score';
      btn.appendChild(el);
    }
    el.textContent = val > 0 ? `Best: ${val.toLocaleString()}` : '';
  }

  function onNewHighScore(gameName, score) {
    // Update tile immediately
    const btn = document.querySelector(`.game-tile[data-game="${gameName}"]`);
    if (btn) renderTileScore(btn, score);

    // Save to repo if owner is logged in
    if (!window.Autonom?.isOwner?.()) return;
    fetch('site-config.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(cfg => {
        cfg.highScores = cfg.highScores || {};
        cfg.highScores[gameName] = score;
        return window.Autonom.saveConfig(cfg, `games: new ${gameName} high score ${score}`);
      })
      .catch(() => {}); // silent — game must not be interrupted
  }

  // ─── Login hint ─────────────────────────────────────────────────────────────
  function updateLoginHint() {
    if (!loginHint) return;
    // Only show hint to the page owner who isn't logged in
    const hostname = location.hostname;
    const isOwnerDomain = hostname.endsWith('.github.io') || hostname === 'localhost';
    const loggedIn = window.Autonom?.isOwner?.();
    loginHint.classList.toggle('hidden', !isOwnerDomain || !!loggedIn);
  }

  // ─── Orientation hint ───────────────────────────────────────────────────────
  function updateOrientHint(name) {
    if (!orientHint || !isTouch) return;
    const needsLandscape = ['spaceinvaders', 'breakout'];
    const isPortrait = window.innerHeight > window.innerWidth;
    orientHint.classList.toggle('hidden', !needsLandscape.includes(name) || !isPortrait);
  }

  // ─── Pause ──────────────────────────────────────────────────────────────────
  function togglePause() {
    if (!activeGame) return;
    const game = window.Games[activeGame];
    if (isPaused) {
      game.resume?.();
      isPaused = false;
      if (pauseBtn) pauseBtn.textContent = '⏸';
    } else {
      game.pause?.();
      isPaused = true;
      if (pauseBtn) pauseBtn.textContent = '▶';
    }
  }

  pauseBtn?.addEventListener('click', togglePause);

  // ─── Canvas click — restart button + swipe origin ───────────────────────────
  canvas.addEventListener('click', e => {
    const btn = canvas._restartBtn;
    if (!btn) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;
    if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
      canvas._restartBtn = null;
      isPaused = false;
      if (pauseBtn) pauseBtn.textContent = '⏸';
      window.Games[activeGame]?.newGame?.();
    }
  });

  // ─── Swipe for Snake & Pac-Man ───────────────────────────────────────────────
  let swipeStart = null;
  canvas.addEventListener('touchstart', e => {
    swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  canvas.addEventListener('touchend', e => {
    if (!swipeStart || !activeGame) return;
    const dx = e.changedTouches[0].clientX - swipeStart.x;
    const dy = e.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // too short

    const game = window.Games[activeGame];
    if (!game?.setDir) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      game.setDir(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      game.setDir(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }, { passive: true });

  // ─── Breakout touchmove ──────────────────────────────────────────────────────
  canvas.addEventListener('touchmove', e => {
    if (activeGame !== 'breakout') return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect  = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: touch.clientX, clientY: touch.clientY, bubbles: true,
    }));
  }, { passive: false });

  // ─── D-pad buttons ───────────────────────────────────────────────────────────
  function fireKey(key, type) {
    document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  }

  document.querySelectorAll('.dpad-btn').forEach(btn => {
    const key = btn.dataset.key;
    btn.addEventListener('touchstart', e => { e.preventDefault(); fireKey(key, 'keydown'); }, { passive: false });
    btn.addEventListener('touchend',   e => { e.preventDefault(); fireKey(key, 'keyup');   }, { passive: false });
  });

  // ─── Shooter buttons — direct API, no synthetic keys ────────────────────────
  const siLeft  = document.getElementById('si-left');
  const siRight = document.getElementById('si-right');
  const siFire  = document.getElementById('si-fire');

  function siPress(fn)   { return e => { e.preventDefault(); fn(); }; }
  function siRelease()   { window.Games.spaceinvaders?.setDx(0); }

  siLeft?.addEventListener('touchstart',  siPress(() => window.Games.spaceinvaders?.setDx(-1)), { passive: false });
  siLeft?.addEventListener('touchend',    siPress(siRelease), { passive: false });
  siRight?.addEventListener('touchstart', siPress(() => window.Games.spaceinvaders?.setDx(1)),  { passive: false });
  siRight?.addEventListener('touchend',   siPress(siRelease), { passive: false });
  siFire?.addEventListener('touchstart',  siPress(() => window.Games.spaceinvaders?.fire()),    { passive: false });

  // ─── Show / hide controls ────────────────────────────────────────────────────
  function showControls(name) {
    ctrlDpad?.classList.add('hidden');
    ctrlShooter?.classList.add('hidden');
    if (!isTouch) return;
    if (DPAD_GAMES.includes(name)) {
      ctrlDpad?.classList.remove('hidden');
      const dropBtn = document.querySelector('.dpad-drop');
      if (dropBtn) dropBtn.classList.toggle('hidden', name !== 'tetris');
    }
    if (SHOOTER_GAMES.includes(name)) ctrlShooter?.classList.remove('hidden');
  }

  // ─── Show / hide game ────────────────────────────────────────────────────────
  function showGame(name) {
    const game = window.Games[name];
    if (!game) return;
    picker.classList.add('hidden');
    viewport.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    pauseBtn?.classList.remove('hidden');
    isPaused = false;
    if (pauseBtn) pauseBtn.textContent = '⏸';
    activeGame = name;
    canvas._restartBtn = null;

    const hiCallback = score => onNewHighScore(name, score);
    game.start(canvas, hiCallback);
    showControls(name);
    updateOrientHint(name);
    updateLoginHint();
  }

  function stopGame() {
    if (activeGame && window.Games[activeGame]?.stop) {
      window.Games[activeGame].stop();
    }
    activeGame = null;
    isPaused   = false;
    canvas._restartBtn = null;
    ctrlDpad?.classList.add('hidden');
    ctrlShooter?.classList.add('hidden');
    orientHint?.classList.add('hidden');
    loginHint?.classList.add('hidden');
    pauseBtn?.classList.add('hidden');
    viewport.classList.add('hidden');
    backBtn.classList.add('hidden');
    picker.classList.remove('hidden');
  }

  document.querySelectorAll('.game-tile').forEach(btn => {
    btn.addEventListener('click', () => showGame(btn.dataset.game));
  });

  backBtn?.addEventListener('click', stopGame);
  window.addEventListener('beforeunload', stopGame);
  window.addEventListener('resize', () => { if (activeGame) updateOrientHint(activeGame); });

  // Load scores on page ready
  loadHighScores();
})();
