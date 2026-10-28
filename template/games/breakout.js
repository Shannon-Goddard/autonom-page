(() => {
  window.Games = window.Games || {};
  let ctx, W, H, paddle, ball, bricks, score, hi, lives, raf, running, paused, onNewHi;

  const BRICK_ROWS = 5, BRICK_COLS = 10, BRICK_H = 16, BRICK_PAD = 4;
  const COLORS = ['#e94560','#f4a261','#e9c46a','#04AA6D','#457b9d'];

  function start(canvas, hiCallback) {
    W = canvas.width  = 480;
    H = canvas.height = 360;
    ctx = canvas.getContext('2d');
    hi  = parseInt(localStorage.getItem('breakout-hi') || '0');
    onNewHi = hiCallback || null;
    paused = false;
    newGame();
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('mousemove', onMouse);
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

  function newGame() {
    cancelAnimationFrame(raf);
    paddle  = { x: W/2 - 40, y: H - 24, w: 80, h: 10, dx: 0 };
    ball    = { x: W/2, y: H - 40, r: 7, dx: 3, dy: -4 };
    score   = 0;
    lives   = 3;
    running = true;
    paused  = false;
    buildBricks();
    loop();
  }

  function buildBricks() {
    const bw = (W - BRICK_PAD) / BRICK_COLS - BRICK_PAD;
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++)
      for (let c = 0; c < BRICK_COLS; c++)
        bricks.push({
          x: BRICK_PAD + c * (bw + BRICK_PAD),
          y: 40 + r * (BRICK_H + BRICK_PAD),
          w: bw, h: BRICK_H,
          color: COLORS[r % COLORS.length],
          alive: true,
        });
  }

  function loop() {
    if (!running || paused) return;
    raf = requestAnimationFrame(loop);
    update();
    draw();
  }

  function update() {
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x + paddle.dx));

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x - ball.r < 0)  { ball.x = ball.r;      ball.dx *= -1; }
    if (ball.x + ball.r > W)  { ball.x = W - ball.r;  ball.dx *= -1; }
    if (ball.y - ball.r < 0)  { ball.y = ball.r;       ball.dy *= -1; }

    if (ball.y + ball.r >= paddle.y &&
        ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
      ball.dy = -Math.abs(ball.dy);
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      ball.dx = hit * 5;
    }

    if (ball.y - ball.r > H) {
      lives--;
      if (lives <= 0) {
        running = false;
        cancelAnimationFrame(raf);
        draw();
        showGameOver();
        return;
      }
      ball = { x: W/2, y: H - 40, r: 7, dx: 3, dy: -4 };
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        ball.dy *= -1;
        score += 10;
        if (score > hi) {
          hi = score;
          localStorage.setItem('breakout-hi', hi);
          onNewHi?.(hi);
        }
      }
    }

    if (bricks.every(b => !b.alive)) {
      buildBricks();
      ball.dx *= 1.1;
      ball.dy *= 1.1;
    }
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    bricks.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    ctx.fillStyle = '#eaeaea';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560';
    ctx.fill();

    ctx.fillStyle = '#eaeaea';
    ctx.font = '13px monospace';
    ctx.fillText(`Score: ${score}  Best: ${hi}  Lives: ${'♥'.repeat(lives)}`, 8, 18);
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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
    if (e.key === 'p' || e.key === 'P') { paused ? resume() : pause(); return; }
    if (e.key === ' ' && !running) { e.preventDefault(); newGame(); }
    paddle.dx = keys['ArrowLeft'] ? -6 : keys['ArrowRight'] ? 6 : 0;
  }
  function onKeyUp(e) {
    keys[e.key] = false;
    paddle.dx = keys['ArrowLeft'] ? -6 : keys['ArrowRight'] ? 6 : 0;
  }
  function onMouse(e) {
    const rect = e.target.getBoundingClientRect();
    paddle.x = e.clientX - rect.left - paddle.w / 2;
  }

  window.Games.breakout = { start, stop, pause, resume, newGame };
})();
