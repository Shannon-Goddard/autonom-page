(() => {
  window.Games = window.Games || {};
  const CELL = 16;
  const MAP_SRC = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,0,0,1,1,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,1,1,0,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  const ROWS = MAP_SRC.length, COLS = MAP_SRC[0].length;

  let ctx, W, H, map, pac, ghosts, score, hi, lives, raf, running, paused, powerTimer, onNewHi;

  const GHOST_COLORS = ['#e94560','#f4a261','#a8dadc','#9b5de5'];
  const DIRS = [{ x:1,y:0 },{ x:-1,y:0 },{ x:0,y:1 },{ x:0,y:-1 }];

  function start(canvas, hiCallback) {
    W = canvas.width  = COLS * CELL;
    H = canvas.height = ROWS * CELL + 24;
    ctx = canvas.getContext('2d');
    hi  = parseInt(localStorage.getItem('pacman-hi') || '0');
    onNewHi = hiCallback || null;
    paused = false;
    newGame();
    document.addEventListener('keydown', onKey);
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
    map   = MAP_SRC.map(r => [...r]);
    score = 0; lives = 3; powerTimer = 0; running = true; paused = false;
    pac   = { x: 9, y: 16, dx: 0, dy: 0, ndx: 0, ndy: 0, timer: 0 };
    ghosts = GHOST_COLORS.map((c, i) => ({
      x: 8 + i, y: 9, dx: 1, dy: 0, color: c, timer: 0, scared: false,
    }));
    loop();
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
    if (powerTimer > 0) powerTimer -= dt;

    pac.timer += dt;
    if (pac.timer >= 150) {
      pac.timer = 0;
      const nx = pac.x + pac.ndx, ny = pac.y + pac.ndy;
      if (inBounds(nx, ny) && map[ny][nx] !== 1) {
        pac.dx = pac.ndx; pac.dy = pac.ndy;
      }
      const mx = pac.x + pac.dx, my = pac.y + pac.dy;
      if (inBounds(mx, my) && map[my][mx] !== 1) {
        pac.x = mx; pac.y = my;
        if (pac.x < 0) pac.x = COLS - 1;
        if (pac.x >= COLS) pac.x = 0;
      }
      const tile = map[pac.y]?.[pac.x];
      if (tile === 2) { map[pac.y][pac.x] = 0; score += 10; }
      if (tile === 3) {
        map[pac.y][pac.x] = 0; score += 50;
        powerTimer = 7000;
        ghosts.forEach(g => g.scared = true);
      }
      if (score > hi) {
        hi = score;
        localStorage.setItem('pacman-hi', hi);
        onNewHi?.(hi);
      }
      if (map.every(r => r.every(v => v !== 2 && v !== 3))) {
        map = MAP_SRC.map(r => [...r]);
      }
    }

    ghosts.forEach(g => {
      g.scared = powerTimer > 0;
      g.timer += dt;
      if (g.timer < 200) return;
      g.timer = 0;
      let chosen = null;
      if (!g.scared) {
        let best = Infinity;
        DIRS.forEach(d => {
          const nx = g.x + d.x, ny = g.y + d.y;
          if (!inBounds(nx, ny) || map[ny][nx] === 1) return;
          if (d.x === -g.dx && d.y === -g.dy) return;
          const dist = Math.abs(nx - pac.x) + Math.abs(ny - pac.y);
          if (dist < best) { best = dist; chosen = d; }
        });
      }
      if (!chosen) {
        const opts = DIRS.filter(d => {
          const nx = g.x + d.x, ny = g.y + d.y;
          return inBounds(nx, ny) && map[ny][nx] !== 1 &&
                 !(d.x === -g.dx && d.y === -g.dy);
        });
        chosen = opts[Math.floor(Math.random() * opts.length)] || { x: 0, y: 0 };
      }
      g.dx = chosen.x; g.dy = chosen.y;
      g.x += g.dx; g.y += g.dy;

      if (g.x === pac.x && g.y === pac.y) {
        if (g.scared) {
          score += 200;
          g.x = 9; g.y = 9; g.scared = false;
        } else {
          lives--;
          if (lives <= 0) { running = false; showGameOver(); return; }
          pac.x = 9; pac.y = 16; pac.dx = 0; pac.dy = 0;
          ghosts.forEach((gh, i) => { gh.x = 8 + i; gh.y = 9; });
        }
      }
    });
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = map[r][c];
        const px = c * CELL, py = r * CELL;
        if (v === 1) {
          ctx.fillStyle = '#0f3460';
          ctx.fillRect(px, py, CELL, CELL);
        } else if (v === 2) {
          ctx.fillStyle = '#eaeaea';
          ctx.beginPath();
          ctx.arc(px + CELL/2, py + CELL/2, 2, 0, Math.PI*2);
          ctx.fill();
        } else if (v === 3) {
          ctx.fillStyle = '#e9c46a';
          ctx.beginPath();
          ctx.arc(px + CELL/2, py + CELL/2, 5, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.arc(pac.x*CELL + CELL/2, pac.y*CELL + CELL/2, CELL/2 - 1, 0.25, Math.PI*1.75);
    ctx.lineTo(pac.x*CELL + CELL/2, pac.y*CELL + CELL/2);
    ctx.fill();

    ghosts.forEach(g => {
      ctx.fillStyle = g.scared ? '#457b9d' : g.color;
      const gx = g.x*CELL, gy = g.y*CELL;
      ctx.beginPath();
      ctx.arc(gx + CELL/2, gy + CELL/2, CELL/2 - 1, Math.PI, 0);
      ctx.lineTo(gx + CELL - 1, gy + CELL);
      ctx.lineTo(gx + CELL*0.75, gy + CELL*0.75);
      ctx.lineTo(gx + CELL/2, gy + CELL);
      ctx.lineTo(gx + CELL*0.25, gy + CELL*0.75);
      ctx.lineTo(gx + 1, gy + CELL);
      ctx.closePath();
      ctx.fill();
    });

    ctx.fillStyle = '#eaeaea';
    ctx.font = '13px monospace';
    ctx.fillText(`Score: ${score}  Best: ${hi}  Lives: ${'♥'.repeat(lives)}`, 8, ROWS*CELL + 17);
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

  function setDir(d) {
    pac.ndx = d.x; pac.ndy = d.y;
  }

  function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  function onKey(e) {
    const map2 = { ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0} };
    const d = map2[e.key];
    if (d) { setDir(d); e.preventDefault(); }
    if (e.key === 'p' || e.key === 'P') { paused ? resume() : pause(); }
    if (e.key === ' ' && !running) { e.preventDefault(); newGame(); }
  }

  window.Games.pacman = { start, stop, pause, resume, setDir, newGame };
})();
