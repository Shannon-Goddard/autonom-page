(() => {
  window.Games = window.Games || {};

  let activeGame = null;

  const picker   = document.getElementById('game-picker');
  const viewport = document.getElementById('game-viewport');
  const canvas   = document.getElementById('game-canvas');
  const backBtn  = document.getElementById('game-back');
  const ctrlDpad    = document.getElementById('ctrl-dpad');
  const ctrlShooter = document.getElementById('ctrl-shooter');

  const DPAD_GAMES    = ['tetris', 'snake', 'pacman'];
  const SHOOTER_GAMES = ['spaceinvaders'];
  const isTouch       = 'ontouchstart' in window;

  // Synthetic key event
  function fireKey(key, type = 'keydown') {
    document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  }

  // Wire a button to fire keydown on press, keyup on release
  function bindBtn(btn) {
    const key = btn.dataset.key;
    btn.addEventListener('touchstart', e => { e.preventDefault(); fireKey(key, 'keydown'); }, { passive: false });
    btn.addEventListener('touchend',   e => { e.preventDefault(); fireKey(key, 'keyup');   }, { passive: false });
  }

  document.querySelectorAll('.dpad-btn, .shoot-btn').forEach(bindBtn);

  // Breakout — drag finger to move paddle
  canvas.addEventListener('touchmove', e => {
    if (activeGame !== 'breakout') return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect  = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
    }));
    // Also pass scaled x directly via a custom property the game reads
    canvas._touchX = (touch.clientX - rect.left) * scaleX;
  }, { passive: false });

  function showControls(name) {
    ctrlDpad.classList.add('hidden');
    ctrlShooter.classList.add('hidden');
    if (!isTouch) return;
    if (DPAD_GAMES.includes(name))    ctrlDpad.classList.remove('hidden');
    if (SHOOTER_GAMES.includes(name)) ctrlShooter.classList.remove('hidden');
  }

  function showGame(name) {
    const game = window.Games[name];
    if (!game) return;
    picker.classList.add('hidden');
    viewport.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    activeGame = name;
    game.start(canvas);
    showControls(name);
  }

  function stopGame() {
    if (activeGame && window.Games[activeGame]?.stop) {
      window.Games[activeGame].stop();
    }
    activeGame = null;
    ctrlDpad.classList.add('hidden');
    ctrlShooter.classList.add('hidden');
    viewport.classList.add('hidden');
    backBtn.classList.add('hidden');
    picker.classList.remove('hidden');
  }

  document.querySelectorAll('.game-tile').forEach(btn => {
    btn.addEventListener('click', () => showGame(btn.dataset.game));
  });

  backBtn?.addEventListener('click', stopGame);
  window.addEventListener('beforeunload', stopGame);
})();
