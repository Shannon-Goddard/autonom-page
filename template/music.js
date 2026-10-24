(() => {
  let config = {};
  let currentIndex = 0;
  const audio = document.getElementById('audio-player');

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) config = await res.json();
    } catch { /* offline */ }

    renderTrackList();
    loadTrack(currentIndex);
    wirePlayer();

    if (Autonom.isOwner()) {
      document.getElementById('upload-track-controls')?.classList.remove('hidden');
      document.getElementById('upload-track-btn')?.addEventListener('click', uploadTracks);
    }
  }

  // ─── Playlist helpers ─────────────────────────────────────────────────────────
  function tracks() { return config.tracks || []; }

  function loadTrack(index) {
    const list = tracks();
    if (!list.length) {
      document.getElementById('player')?.classList.add('hidden');
      return;
    }
    currentIndex = Math.max(0, Math.min(index, list.length - 1));
    const t = list[currentIndex];
    audio.src = `assets/music/${t.filename}`;
    setText('track-title',  t.title  || t.filename);
    setText('track-artist', t.artist || '');
    const dl = document.getElementById('download-track');
    if (dl) { dl.href = `assets/music/${t.filename}`; dl.download = t.filename; }
    document.getElementById('player')?.classList.remove('hidden');
    const playBtn = document.getElementById('play-pause');
    if (playBtn) playBtn.textContent = 'Play';
    highlightActive();
  }

  // ─── Render track list ────────────────────────────────────────────────────────
  function renderTrackList() {
    const list = tracks();
    const el   = document.getElementById('track-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<p class="music-empty">No tracks yet.</p>'; return; }

    el.innerHTML = list.map((t, i) => `
      <div class="track-row${i === currentIndex ? ' track-active' : ''}" data-index="${i}">
        <span class="track-row-title">${t.title || t.filename}</span>
        <span class="track-row-artist">${t.artist || ''}</span>
        ${Autonom.isOwner()
          ? `<button class="remove-track" data-index="${i}" aria-label="Remove ${t.title || t.filename}">&times;</button>`
          : ''}
      </div>`).join('');

    el.querySelectorAll('.track-row').forEach(row =>
      row.addEventListener('click', e => {
        if (e.target.classList.contains('remove-track')) return;
        loadTrack(+row.dataset.index);
        audio.play();
        document.getElementById('play-pause').textContent = 'Pause';
      })
    );
    el.querySelectorAll('.remove-track').forEach(btn =>
      btn.addEventListener('click', () => removeTrack(+btn.dataset.index))
    );
  }

  function highlightActive() {
    document.querySelectorAll('.track-row').forEach((row, i) =>
      row.classList.toggle('track-active', i === currentIndex)
    );
  }

  // ─── Player controls ──────────────────────────────────────────────────────────
  function wirePlayer() {
    const playBtn = document.getElementById('play-pause');
    const seekBar = document.getElementById('seek-bar');
    const volBar  = document.getElementById('volume');

    playBtn?.addEventListener('click', () => {
      if (audio.paused) { audio.play(); playBtn.textContent = 'Pause'; }
      else              { audio.pause(); playBtn.textContent = 'Play'; }
    });

    document.getElementById('prev-track')?.addEventListener('click', () => {
      loadTrack(currentIndex - 1); audio.play();
      if (playBtn) playBtn.textContent = 'Pause';
    });
    document.getElementById('next-track')?.addEventListener('click', () => {
      loadTrack(currentIndex + 1); audio.play();
      if (playBtn) playBtn.textContent = 'Pause';
    });

    audio.addEventListener('ended', () => {
      if (currentIndex < tracks().length - 1) {
        loadTrack(currentIndex + 1); audio.play();
        if (playBtn) playBtn.textContent = 'Pause';
      } else {
        if (playBtn) playBtn.textContent = 'Play';
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration || !seekBar) return;
      seekBar.value = (audio.currentTime / audio.duration) * 100;
    });
    seekBar?.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seekBar.value / 100) * audio.duration;
    });
    volBar?.addEventListener('input', () => { audio.volume = volBar.value; });
  }

  // ─── Upload multiple tracks ───────────────────────────────────────────────────
  async function uploadTracks() {
    const fileInput = document.getElementById('track-upload');
    const files     = Array.from(fileInput?.files || []);
    if (!files.length) { Autonom.toast('Select at least one MP3', 'error'); return; }

    const oversized = files.filter(f => f.size > 20 * 1024 * 1024);
    if (oversized.length) {
      Autonom.toast(`${oversized.map(f => f.name).join(', ')} exceed 20MB limit`, 'error');
      return;
    }

    const btn = document.getElementById('upload-track-btn');
    if (btn) btn.disabled = true;

    const existing = config.tracks || [];
    const added = [];

    for (const file of files) {
      const filename = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
      const buf      = await file.arrayBuffer();
      await Autonom.commitFile(`assets/music/${filename}`, buf, `Upload track ${filename}`, true);
      // Derive title from filename — strip extension, replace dashes/underscores
      const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      added.push({ filename, title, artist: '' });
    }

    const updatedTracks = [...existing, ...added];
    await Autonom.saveConfig(config, { tracks: updatedTracks }, 'Upload tracks');
    await Autonom.regenerateRSS(config);

    renderTrackList();
    if (!existing.length) loadTrack(0);
    Autonom.toast(`${added.length} track${added.length > 1 ? 's' : ''} uploaded`, 'success');
    if (btn) btn.disabled = false;
    fileInput.value = '';
  }

  // ─── Remove track ─────────────────────────────────────────────────────────────
  async function removeTrack(index) {
    const list = tracks();
    const t    = list[index];
    if (!t || !confirm(`Remove "${t.title || t.filename}"?`)) return;
    const updated = list.filter((_, i) => i !== index);
    await Autonom.saveConfig(config, { tracks: updated }, `Remove track ${t.filename}`);
    if (currentIndex >= updated.length) currentIndex = Math.max(0, updated.length - 1);
    renderTrackList();
    loadTrack(currentIndex);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  init();
})();
