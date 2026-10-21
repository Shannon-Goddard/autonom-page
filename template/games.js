(() => {
  window.Games = window.Games || {};

  let activeGame = null;

  const picker   = document.getElementById('game-picker');
  const viewport = document.getElementById('game-viewport');
  const canvas   = document.getElementById('game-canvas');
  const backBtn  = document.getElementById('game-back');

  function showGame(name) {
    const game = window.Games[name];
    if (!game) return;

    picker.classList.add('hidden');
    viewport.classList.remove('hidden');
    backBtn.classList.remove('hidden');

    activeGame = name;
    game.start(canvas);
  }

  function stopGame() {
    if (activeGame && window.Games[activeGame]?.stop) {
      window.Games[activeGame].stop();
    }
    activeGame = null;
    viewport.classList.add('hidden');
    backBtn.classList.add('hidden');
    picker.classList.remove('hidden');
  }

  document.querySelectorAll('.game-tile').forEach(btn => {
    btn.addEventListener('click', () => showGame(btn.dataset.game));
  });

  backBtn?.addEventListener('click', stopGame);

  // Stop game on nav away
  window.addEventListener('beforeunload', stopGame);
})();
