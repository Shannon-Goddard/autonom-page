(() => {
  window.Games = window.Games || {};
  const CELL = 20;
  let raf, snake, dir, next, food, score, hi, ctx, cols, rows, running, paused, onNewHi;

  function start(canvas, hiCallback) {
    cols = Math.floor(canvas.width  / CELL) || 20;
    rows = Math.floor(canvas.height / CELL) || 20;
    canvas.width  = cols * CELL;
    canvas.height = rows * CELL;
    ctx = canvas.getContext('2d');
    hi  = parseInt(localStorage.getItem('snake-hi') || '0');
    onNewHi = hiCallback || null;
    paused = false;
    reset();
    document.addEventListener('keydown', onKey);
    loop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
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
    last = 0;
    loop();
  }

  function newGame() {
    reset();
    loop();
  }

  function reset() {
    snake   = [{ x: 10, y: 10 }];
    dir     = { x: 1, y: 0 };
    next    = { x: 1, y: 0 };
    score   = 0;
    running = true;
    paused  = false;
    placeFood();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }

  let last = 0;
  function loop(ts = 0) {
    if (!running || paused) return;
    raf = requestAnimationFrame(loop);
    if (ts - last < 120) return;
    last = ts;

    dir = { ...next };
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows ||
        snake.some(s => s.x === head.x && s.y === head.y)) {
      gameOver(); return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      if (score > hi) {
        hi = score;
        localStorage.setItem('snake-hi', hi);
        onNewHi?.(hi);
      }
      placeFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cols * CELL, rows * CELL);

    ctx.fillStyle = '#04AA6D';
    snake.forEach(s => ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2));

    ctx.fillStyle = '#e94560';
    ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);

    ctx.fillStyle = '#eaeaea';
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${score}  Best: ${hi}`, 8, 18);
  }

  function drawPaused() {
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cols * CELL, rows * CELL);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', cols * CELL / 2, rows * CELL / 2);
    ctx.textAlign = 'left';
  }

  function gameOver() {
    running = false;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cols * CELL, rows * CELL);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', cols * CELL / 2, rows * CELL / 2 - 30);
    ctx.font = '16px monospace';
    ctx.fillText(`Score: ${score}`, cols * CELL / 2, rows * CELL / 2);
    const bx = cols*CELL/2 - 60, by = rows*CELL/2 + 20, bw = 120, bh = 34;
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('Play Again', cols * CELL / 2, by + 22);
    ctx.textAlign = 'left';
    ctx.canvas._restartBtn = { x: bx, y: by, w: bw, h: bh };
  }

  function setDir(d) {
    if (!(d.x === -dir.x && d.y === -dir.y)) next = d;
  }

  function onKey(e) {
    const map = {
      ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
    };
    const n = map[e.key];
    if (n) { setDir(n); e.preventDefault(); }
    if (e.key === 'p' || e.key === 'P') { paused ? resume() : pause(); }
    if (e.key === ' ') { e.preventDefault(); if (!running) { reset(); loop(); } }
  }

  window.Games.snake = { start, stop, pause, resume, setDir, newGame };
})();
