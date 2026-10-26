(() => {
  window.Games = window.Games || {};
  const COLS = 10, ROWS = 20, CELL = 28;
  const COLORS = ['#e94560','#04AA6D','#f4a261','#457b9d','#e9c46a','#a8dadc','#9b5de5'];
  const SHAPES = [
    [[1,1,1,1]],
    [[1,1],[1,1]],
    [[0,1,0],[1,1,1]],
    [[1,0,0],[1,1,1]],
    [[0,0,1],[1,1,1]],
    [[0,1,1],[1,1,0]],
    [[1,1,0],[0,1,1]],
  ];

  let ctx, board, piece, score, hi, level, lines, raf, running, dropInterval, last;

  function start(canvas) {
    canvas.width  = COLS * CELL;
    canvas.height = ROWS * CELL;
    ctx = canvas.getContext('2d');
    hi  = parseInt(localStorage.getItem('tetris-hi') || '0');
    newGame();
    document.addEventListener('keydown', onKey);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
  }

  function newGame() {
    board        = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score        = 0;
    level        = 1;
    lines        = 0;
    dropInterval = 600;
    running      = true;
    last         = 0;
    piece        = newPiece();
    loop();
  }

  function newPiece() {
    const i = Math.floor(Math.random() * SHAPES.length);
    return { shape: SHAPES[i], color: COLORS[i], x: 3, y: 0 };
  }

  function loop(ts = 0) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (ts - last < dropInterval) { draw(); return; }
    last = ts;
    if (!moveDown()) lock();
  }

  function moveDown() {
    piece.y++;
    if (collides()) { piece.y--; return false; }
    return true;
  }

  function lock() {
    piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) board[piece.y + r][piece.x + c] = piece.color;
      })
    );
    clearLines();
    piece = newPiece();
    if (collides()) { running = false; showGameOver(); }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(v => v)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++; r++;
      }
    }
    if (!cleared) return;
    const pts = [0, 100, 300, 500, 800];
    score += (pts[cleared] || 800) * level;
    lines += cleared;
    level  = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(80, 600 - (level - 1) * 50);
    if (score > hi) { hi = score; localStorage.setItem('tetris-hi', hi); }
  }

  function collides() {
    return piece.shape.some((row, r) =>
      row.some((v, c) => {
        if (!v) return false;
        const nx = piece.x + c, ny = piece.y + r;
        return nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx]);
      })
    );
  }

  function rotate() {
    const orig = piece.shape;
    piece.shape = piece.shape[0].map((_, i) => piece.shape.map(r => r[i]).reverse());
    if (collides()) piece.shape = orig;
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    board.forEach((row, r) =>
      row.forEach((color, c) => {
        if (color) { ctx.fillStyle = color; ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2); }
      })
    );

    piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) {
          ctx.fillStyle = piece.color;
          ctx.fillRect((piece.x+c)*CELL+1, (piece.y+r)*CELL+1, CELL-2, CELL-2);
        }
      })
    );

    ctx.fillStyle = '#eaeaea';
    ctx.font = '13px monospace';
    ctx.fillText(`Score: ${score}  Best: ${hi}  Lv: ${level}`, 4, 14);
  }

  function showGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, COLS*CELL, ROWS*CELL);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', COLS*CELL/2, ROWS*CELL/2 - 20);
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${score}`, COLS*CELL/2, ROWS*CELL/2 + 8);
    ctx.fillText('Space to restart', COLS*CELL/2, ROWS*CELL/2 + 30);
    ctx.textAlign = 'left';
  }

  function onKey(e) {
    if (!running && e.key === ' ') { e.preventDefault(); newGame(); return; }
    if (!running) return;
    if (e.key === 'ArrowLeft')  { piece.x--; if (collides()) piece.x++; e.preventDefault(); }
    if (e.key === 'ArrowRight') { piece.x++; if (collides()) piece.x--; e.preventDefault(); }
    if (e.key === 'ArrowDown')  { moveDown(); e.preventDefault(); }
    if (e.key === 'ArrowUp' || e.key === 'x') { rotate(); e.preventDefault(); }
    if (e.key === ' ')          { while (moveDown()); lock(); e.preventDefault(); }
  }

  window.Games.tetris = { start, stop };
})();
