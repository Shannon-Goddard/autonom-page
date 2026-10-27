(() => {
  window.Games = window.Games || {};
  let ctx, W, H, player, aliens, bullets, bombs, shields, score, hi, lives, raf, running, paused, alienDir, alienSpeed, dropPending, wave, onNewHi;

  function start(canvas, hiCallback) {
    W = canvas.width  = 480;
    H = canvas.height = 400;
    ctx = canvas.getContext('2d');
    hi  = parseInt(localStorage.getItem('si-hi') || '0');
    onNewHi = hiCallback || null;
    paused = false;
    newGame();
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup',   onKeyUp);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup',   onKeyUp);
  }

  function pause() {
    if (!running) return;
    paused = true;
    cancelAnimationFrame(raf);
    drawPaused();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    loop();
  }

  // Called directly by touch controls — no synthetic key events needed
  function setDx(val) { player.dx = val; }
  function fire() {
    if (!running || paused) return;
    if (player.cooldown <= 0) {
      bullets.push({ x: player.x + player.w/2, y: player.y });
      player.cooldown = 300;
    }
  }

  function newGame() {
    wave        = 1;
    score       = 0;
    lives       = 3;
    player      = { x: W/2 - 16, y: H - 36, w: 32, h: 16, dx: 0, cooldown: 0 };
    bullets     = [];
    bombs       = [];
    running     = true;
    paused      = false;
    buildAliens();
    buildShields();
    loop();
  }

  function buildAliens() {
    aliens      = [];
    alienDir    = 1;
    alienSpeed  = 0.4 + wave * 0.15;
    dropPending = false;
    const rows = 4, cols = 10;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        aliens.push({ x: 40 + c * 38, y: 50 + r * 32, w: 24, h: 16, alive: true, row: r });
  }

  function buildShields() {
    shields = [];
    [100, 200, 300, 380].forEach(sx => {
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 5; c++)
          shields.push({ x: sx + c * 8, y: H - 80 + r * 8, w: 8, h: 8, hp: 3 });
    });
  }

  let last = 0;
  function loop(ts = 0) {
    if (!running || paused) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(ts - last, 50);
    last = ts;
    update(dt);
    draw();
  }

  function update(dt) {
    player.x = Math.max(0, Math.min(W - player.w, player.x + player.dx * dt * 0.25));
    if (player.cooldown > 0) player.cooldown -= dt;

    let hitWall = false;
    aliens.forEach(a => {
      if (!a.alive) return;
      a.x += alienDir * alienSpeed * dt * 0.1;
      if (a.x + a.w > W - 10 || a.x < 10) hitWall = true;
    });
    if (hitWall) { alienDir *= -1; aliens.forEach(a => { if (a.alive) a.y += 12; }); }

    if (Math.random() < 0.002 * dt) {
      const live = aliens.filter(a => a.alive);
      if (live.length) {
        const a = live[Math.floor(Math.random() * live.length)];
        bombs.push({ x: a.x + a.w/2, y: a.y + a.h, w: 4, h: 10, dy: 3 });
      }
    }

    bullets = bullets.filter(b => { b.y -= 8; return b.y > 0; });
    bombs   = bombs.filter(b => { b.y += b.dy; return b.y < H; });

    bullets.forEach(b => {
      aliens.forEach(a => {
        if (!a.alive) return;
        if (b.x > a.x && b.x < a.x+a.w && b.y > a.y && b.y < a.y+a.h) {
          a.alive = false; b.y = -1;
          score += (4 - a.row) * 10;
          if (score > hi) {
            hi = score;
            localStorage.setItem('si-hi', hi);
            onNewHi?.(hi);
          }
        }
      });
    });

    [...bullets, ...bombs].forEach(p => {
      shields.forEach(s => {
        if (s.hp <= 0) return;
        if (p.x > s.x && p.x < s.x+s.w && p.y > s.y && p.y < s.y+s.h) {
          s.hp--; p.y = -1;
        }
      });
    });

    bombs.forEach(b => {
      if (b.x > player.x && b.x < player.x+player.w &&
          b.y + b.h > player.y && b.y < player.y+player.h) {
        b.y = H + 1; lives--;
        if (lives <= 0) { running = false; showGameOver(); }
      }
    });

    if (aliens.some(a => a.alive && a.y + a.h >= player.y)) {
      running = false; showGameOver(); return;
    }

    if (aliens.every(a => !a.alive)) { wave++; buildAliens(); }
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    aliens.forEach(a => {
      if (!a.alive) return;
      ctx.fillStyle = a.row === 0 ? '#e94560' : a.row === 1 ? '#f4a261' : '#04AA6D';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.fillRect(a.x + 4, a.y - 4, 4, 4);
      ctx.fillRect(a.x + a.w - 8, a.y - 4, 4, 4);
    });

    ctx.fillStyle = '#eaeaea';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillRect(player.x + 12, player.y - 8, 8, 8);

    ctx.fillStyle = '#04AA6D';
    bullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 10));

    ctx.fillStyle = '#e94560';
    bombs.forEach(b => ctx.fillRect(b.x - 2, b.y, b.w, b.h));

    shields.forEach(s => {
      if (s.hp <= 0) return;
      ctx.fillStyle = s.hp === 3 ? '#04AA6D' : s.hp === 2 ? '#e9c46a' : '#e94560';
      ctx.fillRect(s.x, s.y, s.w, s.h);
    });

    ctx.fillStyle = '#eaeaea';
    ctx.font = '13px monospace';
    ctx.fillText(`Score: ${score}  Best: ${hi}  Lives: ${'♥'.repeat(lives)}  Wave: ${wave}`, 8, 18);
  }

  function drawPaused() {
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', W/2, H/2);
    ctx.textAlign = 'left';
  }

  function showGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', W/2, H/2 - 30);
    ctx.font = '15px monospace';
    ctx.fillText(`Score: ${score}`, W/2, H/2);
    const bx = W/2 - 60, by = H/2 + 20, bw = 120, bh = 34;
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('Play Again', W/2, by + 22);
    ctx.textAlign = 'left';
    ctx.canvas._restartBtn = { x: bx, y: by, w: bw, h: bh };
  }

  let keys = {};
  function onKey(e) {
    keys[e.key] = true;
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (e.key === 'p' || e.key === 'P') { paused ? resume() : pause(); return; }
    player.dx = keys['ArrowLeft'] ? -1 : keys['ArrowRight'] ? 1 : 0;
    if (e.key === ' ') {
      if (!running) { newGame(); return; }
      fire();
    }
  }
  function onKeyUp(e) {
    keys[e.key] = false;
    player.dx = keys['ArrowLeft'] ? -1 : keys['ArrowRight'] ? 1 : 0;
  }

  window.Games.spaceinvaders = { start, stop, pause, resume, newGame, setDx, fire };
})();
