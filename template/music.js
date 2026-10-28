(() => {
  let config = {};
  let currentIndex = 0;
  let shuffleOn  = false;
  let repeatMode = 'off'; // 'off' | 'all' | 'one'
  let shuffleOrder = [];
  let dragSrcIndex = null;
  const audio = document.getElementById('audio-player');

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) {
        config = await res.json();
        const cached = JSON.parse(localStorage.getItem('music-tracks') || 'null');
        if (cached && cached.length > (config.tracks?.length || 0)) {
          config.tracks = cached;
        } else if (config.tracks?.length) {
          localStorage.setItem('music-tracks', JSON.stringify(config.tracks));
        }
      }
    } catch { /* offline */ }

    buildShuffleOrder();
    renderTrackList();
    if (!tracks().length) {
      setText('track-title', 'No tracks yet');
      setText('track-artist', '');
      document.getElementById('player')?.classList.add('no-track');
    } else {
      loadTrack(0);
    }
    wirePlayer();

    if (Autonom.isOwner()) {
      document.getElementById('upload-track-controls')?.classList.remove('hidden');
      document.getElementById('upload-track-btn')?.addEventListener('click', uploadTracks);
    }
  }

  // ─── Playlist helpers ─────────────────────────────────────────────────────────
  function tracks() { return config.tracks || []; }

  function buildShuffleOrder() {
    const len = tracks().length;
    shuffleOrder = Array.from({ length: len }, (_, i) => i);
    for (let i = len - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
    }
  }

  function nextIndex() {
    const list = tracks();
    if (!list.length) return 0;
    if (shuffleOn) {
      const pos = shuffleOrder.indexOf(currentIndex);
      const next = (pos + 1) % shuffleOrder.length;
      return shuffleOrder[next];
    }
    return (currentIndex + 1) % list.length;
  }

  function prevIndex() {
    const list = tracks();
    if (!list.length) return 0;
    if (shuffleOn) {
      const pos = shuffleOrder.indexOf(currentIndex);
      const prev = (pos - 1 + shuffleOrder.length) % shuffleOrder.length;
      return shuffleOrder[prev];
    }
    return (currentIndex - 1 + list.length) % list.length;
  }

  function loadTrack(index) {
    const list = tracks();
    if (!list.length) return;
    currentIndex = Math.max(0, Math.min(index, list.length - 1));
    const t = list[currentIndex];
    audio.src = `assets/music/${t.filename}`;
    setText('track-title',  t.title  || t.filename);
    setText('track-artist', t.artist || '');
    const dl = document.getElementById('download-track');
    if (dl) { dl.href = `assets/music/${t.filename}`; dl.download = t.filename; }
    const playBtn = document.getElementById('play-pause');
    if (playBtn) playBtn.textContent = 'Play';
    setText('time-current', '0:00');
    setText('time-total',   '0:00');
    const seekBar = document.getElementById('seek-bar');
    if (seekBar) seekBar.value = 0;
    document.getElementById('player')?.classList.remove('no-track');
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
      <div class="track-row${i === currentIndex ? ' track-active' : ''}" data-index="${i}" ${isOwner ? 'draggable="true"' : ''}>
        ${isOwner ? `<span class="drag-handle" aria-hidden="true">&#9776;</span>` : ''}
        <div class="track-row-meta">
          ${isOwner
            ? `<input class="track-edit-title" data-index="${i}" value="${escAttr(t.title || '')}" placeholder="Title" aria-label="Edit title" />
               <input class="track-edit-artist" data-index="${i}" value="${escAttr(t.artist || '')}" placeholder="Artist" aria-label="Edit artist" />`
            : `<span class="track-row-title">${esc(t.title || t.filename)}</span>
               <span class="track-row-artist">${esc(t.artist || '')}</span>`
          }
        </div>
        <div class="track-row-actions">
          ${isOwner ? `
            <button class="track-move-up" data-index="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
            <button class="track-move-dn" data-index="${i}" aria-label="Move down" ${i === list.length - 1 ? 'disabled' : ''}>&#9660;</button>
            <button class="remove-track" data-index="${i}" aria-label="Remove ${escAttr(t.title || t.filename)}">&times;</button>
          ` : ''}
        </div>
      </div>`).join('');

    el.querySelectorAll('.track-row').forEach(row =>
      row.addEventListener('click', e => {
        if (['remove-track','track-move-up','track-move-dn','track-edit-title','track-edit-artist','drag-handle'].some(c => e.target.classList.contains(c))) return;
        loadTrack(+row.dataset.index);
        audio.play();
        document.getElementById('play-pause').textContent = 'Pause';
      })
    );

    if (isOwner) {
      el.querySelectorAll('.remove-track').forEach(btn =>
        btn.addEventListener('click', () => removeTrack(+btn.dataset.index))
      );
      el.querySelectorAll('.track-move-up').forEach(btn =>
        btn.addEventListener('click', () => moveTrack(+btn.dataset.index, -1))
      );
      el.querySelectorAll('.track-move-dn').forEach(btn =>
        btn.addEventListener('click', () => moveTrack(+btn.dataset.index, 1))
      );
      el.querySelectorAll('.track-edit-title').forEach(input =>
        input.addEventListener('blur', () => saveTrackMeta(+input.dataset.index, 'title', input.value.trim()))
      );
      el.querySelectorAll('.track-edit-artist').forEach(input =>
        input.addEventListener('blur', () => saveTrackMeta(+input.dataset.index, 'artist', input.value.trim()))
      );
      wireDragDrop(el);
    }
  }

  function highlightActive() {
    document.querySelectorAll('.track-row').forEach((row, i) =>
      row.classList.toggle('track-active', i === currentIndex)
    );
  }

  // ─── Move track (arrows) ──────────────────────────────────────────────────────
  async function moveTrack(index, dir) {
    const list  = [...tracks()];
    const other = index + dir;
    if (other < 0 || other >= list.length) return;
    [list[index], list[other]] = [list[other], list[index]];
    if (currentIndex === index) currentIndex = other;
    else if (currentIndex === other) currentIndex = index;
    await saveTrackOrder(list);
  }

  // ─── Drag-and-drop reorder ────────────────────────────────────────────────────
  function wireDragDrop(el) {
    el.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrcIndex = +row.dataset.index;
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        el.querySelectorAll('.track-row').forEach(r => r.classList.remove('drag-over'));
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.querySelectorAll('.track-row').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      });
      row.addEventListener('drop', async e => {
        e.preventDefault();
        const destIndex = +row.dataset.index;
        if (dragSrcIndex === null || dragSrcIndex === destIndex) return;
        const list = [...tracks()];
        const [moved] = list.splice(dragSrcIndex, 1);
        list.splice(destIndex, 0, moved);
        if (currentIndex === dragSrcIndex) currentIndex = destIndex;
        else if (dragSrcIndex < destIndex && currentIndex > dragSrcIndex && currentIndex <= destIndex) currentIndex--;
        else if (dragSrcIndex > destIndex && currentIndex < dragSrcIndex && currentIndex >= destIndex) currentIndex++;
        dragSrcIndex = null;
        await saveTrackOrder(list);
      });
    });
  }

  async function saveTrackOrder(list) {
    config.tracks = list;
    localStorage.setItem('music-tracks', JSON.stringify(list));
    buildShuffleOrder();
    renderTrackList();
    highlightActive();
    await Autonom.saveConfig(config, { tracks: list }, 'Reorder tracks');
  }

  // ─── Save track title / artist inline ────────────────────────────────────────
  async function saveTrackMeta(index, field, value) {
    const list = tracks();
    if (!list[index] || list[index][field] === value) return;
    list[index][field] = value;
    if (index === currentIndex) {
      if (field === 'title')  setText('track-title',  value || list[index].filename);
      if (field === 'artist') setText('track-artist', value);
    }
    await Autonom.saveConfig(config, { tracks: list }, `Update track ${field}`);
  }

  // ─── Player controls ──────────────────────────────────────────────────────────
  function wirePlayer() {
    const playBtn    = document.getElementById('play-pause');
    const seekBar    = document.getElementById('seek-bar');
    const volBar     = document.getElementById('volume');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn  = document.getElementById('repeat-btn');

    playBtn?.addEventListener('click', () => {
      if (audio.paused) { audio.play(); playBtn.textContent = 'Pause'; }
      else              { audio.pause(); playBtn.textContent = 'Play'; }
    });

    document.getElementById('prev-track')?.addEventListener('click', () => {
      loadTrack(prevIndex()); audio.play();
      if (playBtn) playBtn.textContent = 'Pause';
    });
    document.getElementById('next-track')?.addEventListener('click', () => {
      loadTrack(nextIndex()); audio.play();
      if (playBtn) playBtn.textContent = 'Pause';
    });

    audio.addEventListener('ended', () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0; audio.play(); return;
      }
      const ni = nextIndex();
      if (repeatMode === 'all' || ni !== currentIndex || shuffleOn) {
        loadTrack(ni); audio.play();
        if (playBtn) playBtn.textContent = 'Pause';
      } else if (!shuffleOn && currentIndex >= tracks().length - 1 && repeatMode === 'off') {
        if (playBtn) playBtn.textContent = 'Play';
      } else {
        loadTrack(ni); audio.play();
        if (playBtn) playBtn.textContent = 'Pause';
      }
    });

    audio.addEventListener('loadedmetadata', () => setText('time-total', formatTime(audio.duration)));
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      if (seekBar) seekBar.value = (audio.currentTime / audio.duration) * 100;
      setText('time-current', formatTime(audio.currentTime));
    });
    seekBar?.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seekBar.value / 100) * audio.duration;
    });
    volBar?.addEventListener('input', () => { audio.volume = volBar.value; });

    // Shuffle
    shuffleBtn?.addEventListener('click', () => {
      shuffleOn = !shuffleOn;
      if (shuffleOn) buildShuffleOrder();
      shuffleBtn.classList.toggle('player-btn-active', shuffleOn);
      shuffleBtn.title = shuffleOn ? 'Shuffle: On' : 'Shuffle: Off';
    });

    // Repeat — cycles off → all → one
    repeatBtn?.addEventListener('click', () => {
      repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
      repeatBtn.classList.toggle('player-btn-active', repeatMode !== 'off');
      repeatBtn.textContent = repeatMode === 'one' ? '🔂' : '🔁';
      repeatBtn.title = repeatMode === 'off' ? 'Repeat: Off' : repeatMode === 'all' ? 'Repeat: All' : 'Repeat: One';
    });
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
    buildShuffleOrder();
    try { await Autonom.regenerateRSS(config); } catch { /* non-fatal */ }

    renderTrackList();
    Autonom.toast(`${added.length} track${added.length > 1 ? 's' : ''} uploaded`, 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Tracks'; }
    fileInput.value = '';
  }

  // ─── Remove track ─────────────────────────────────────────────────────────────
  async function removeTrack(index) {
    const list = tracks();
    const t    = list[index];
    if (!t || !confirm(`Remove "${t.title || t.filename}"?`)) return;

    try { await Autonom.deleteFile(`assets/music/${t.filename}`, `Remove track ${t.filename}`); }
    catch { /* already gone */ }

    const updated = list.filter((_, i) => i !== index);
    await Autonom.saveConfig(config, { tracks: updated }, `Remove track ${t.filename}`);
    config.tracks = updated;
    localStorage.setItem('music-tracks', JSON.stringify(updated));
    buildShuffleOrder();

    if (currentIndex >= updated.length) currentIndex = Math.max(0, updated.length - 1);
    renderTrackList();
    if (updated.length) loadTrack(currentIndex);
    else {
      setText('track-title', 'No tracks yet');
      setText('track-artist', '');
      document.getElementById('player')?.classList.add('no-track');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function formatTime(s) {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  init();
})();
