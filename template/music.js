(() => {
  let config = {};
  let currentIndex = 0;
  const audio = document.getElementById('audio-player');

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) {
        config = await res.json();
        // GitHub Pages rebuild lag — if fetched config has fewer tracks than
        // locally cached, use the local copy until Pages catches up
        const cached = JSON.parse(localStorage.getItem('music-tracks') || 'null');
        if (cached && cached.length > (config.tracks?.length || 0)) {
          config.tracks = cached;
        } else if (config.tracks?.length) {
          localStorage.setItem('music-tracks', JSON.stringify(config.tracks));
        }
      }
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
    setText('time-current', '0:00');
    setText('time-total',   '0:00');
    const seekBar = document.getElementById('seek-bar');
    if (seekBar) seekBar.value = 0;
    highlightActive();
  }

  // ─── Render track list ────────────────────────────────────────────────────────
  function renderTrackList() {
    const list = tracks();
    const el   = document.getElementById('track-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<p class="music-empty">No tracks yet.</p>'; return; }

    const isOwner = Autonom.isOwner();
    el.innerHTML = list.map((t, i) => `
      <div class="track-row${i === currentIndex ? ' track-active' : ''}" data-index="${i}">
        <div class="track-row-meta">
          ${isOwner
            ? `<input class="track-edit-title" data-index="${i}" value="${escAttr(t.title || '')}" placeholder="Title" aria-label="Edit title" />
               <input class="track-edit-artist" data-index="${i}" value="${escAttr(t.artist || '')}" placeholder="Artist" aria-label="Edit artist" />`
            : `<span class="track-row-title">${esc(t.title || t.filename)}</span>
               <span class="track-row-artist">${esc(t.artist || '')}</span>`
          }
        </div>
        ${isOwner ? `<button class="remove-track" data-index="${i}" aria-label="Remove ${escAttr(t.title || t.filename)}">&times;</button>` : ''}
      </div>`).join('');

    el.querySelectorAll('.track-row').forEach(row =>
      row.addEventListener('click', e => {
        if (e.target.classList.contains('remove-track')) return;
        if (e.target.classList.contains('track-edit-title')) return;
        if (e.target.classList.contains('track-edit-artist')) return;
        loadTrack(+row.dataset.index);
        audio.play();
        document.getElementById('play-pause').textContent = 'Pause';
      })
    );

    el.querySelectorAll('.remove-track').forEach(btn =>
      btn.addEventListener('click', () => removeTrack(+btn.dataset.index))
    );

    // Inline edit — save on blur
    el.querySelectorAll('.track-edit-title').forEach(input =>
      input.addEventListener('blur', () => saveTrackMeta(+input.dataset.index, 'title', input.value.trim()))
    );
    el.querySelectorAll('.track-edit-artist').forEach(input =>
      input.addEventListener('blur', () => saveTrackMeta(+input.dataset.index, 'artist', input.value.trim()))
    );
  }

  function highlightActive() {
    document.querySelectorAll('.track-row').forEach((row, i) =>
      row.classList.toggle('track-active', i === currentIndex)
    );
  }

  // ─── Save track title / artist inline ────────────────────────────────────────
  async function saveTrackMeta(index, field, value) {
    const list = tracks();
    if (!list[index] || list[index][field] === value) return;
    list[index][field] = value;
    // Update player display if this is the active track
    if (index === currentIndex) {
      if (field === 'title')  setText('track-title',  value || list[index].filename);
      if (field === 'artist') setText('track-artist', value);
    }
    await Autonom.saveConfig(config, { tracks: list }, `Update track ${field}`);
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

    audio.addEventListener('loadedmetadata', () => {
      setText('time-total', formatTime(audio.duration));
    });

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      if (seekBar) seekBar.value = (audio.currentTime / audio.duration) * 100;
      setText('time-current', formatTime(audio.currentTime));
    });

    seekBar?.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seekBar.value / 100) * audio.duration;
    });
    volBar?.addEventListener('input', () => { audio.volume = volBar.value; });
  }

  // ─── Upload tracks ────────────────────────────────────────────────────────────
  async function uploadTracks() {
    const fileInput = document.getElementById('track-upload');
    const files     = Array.from(fileInput?.files || []);
    if (!files.length) { Autonom.toast('Select at least one audio file', 'error'); return; }

    const oversized = files.filter(f => f.size > 20 * 1024 * 1024);
    if (oversized.length) {
      Autonom.toast(`${oversized.map(f => f.name).join(', ')} exceed 20MB limit`, 'error');
      return;
    }

    const btn = document.getElementById('upload-track-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

    const existing = config.tracks || [];
    const added = [];

    for (const [i, file] of files.entries()) {
      if (btn) btn.textContent = `Uploading ${i + 1} of ${files.length}…`;
      const filename = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
      const buf      = await file.arrayBuffer();
      await Autonom.commitFile(`assets/music/${filename}`, buf, `Upload track ${filename}`, true);
      const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      added.push({ filename, title, artist: '' });
    }

    if (btn) btn.textContent = 'Saving…';
    const updatedTracks = [...existing, ...added];
    await Autonom.saveConfig(config, { tracks: updatedTracks }, 'Upload tracks');
    config.tracks = updatedTracks;
    localStorage.setItem('music-tracks', JSON.stringify(updatedTracks));
    try { await Autonom.regenerateRSS(config); } catch { /* non-fatal */ }

    renderTrackList();
    if (!existing.length) loadTrack(0);
    Autonom.toast(`${added.length} track${added.length > 1 ? 's' : ''} uploaded`, 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Tracks'; }
    fileInput.value = '';
  }

  // ─── Remove track + delete file from repo ────────────────────────────────────
  async function removeTrack(index) {
    const list = tracks();
    const t    = list[index];
    if (!t || !confirm(`Remove "${t.title || t.filename}"?`)) return;

    try {
      await Autonom.deleteFile(`assets/music/${t.filename}`, `Remove track ${t.filename}`);
    } catch { /* file may already be gone */ }

    const updated = list.filter((_, i) => i !== index);
    await Autonom.saveConfig(config, { tracks: updated }, `Remove track ${t.filename}`);
    config.tracks = updated;
    localStorage.setItem('music-tracks', JSON.stringify(updated));

    if (currentIndex >= updated.length) currentIndex = Math.max(0, updated.length - 1);
    renderTrackList();
    loadTrack(currentIndex);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function formatTime(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  init();
})();
