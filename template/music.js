(() => {
  let config       = {};
  let currentIndex = 0;   // index into tracks()
  let shuffleOn    = false;
  let repeatMode   = 'off'; // 'off' | 'all' | 'one'
  let shuffleOrder = [];
  let dragSrcIndex = null;
  const metaTimers = {}; // debounce timers keyed by track index

  // Active filters & sort
  let filterPlaylist = '';
  let filterAlbum    = '';
  let filterArtist   = '';
  let sortMode       = 'default';

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
    populateFilters();
    renderTrackList();

    if (!tracks().length) {
      setText('track-title', 'No tracks yet');
      setText('track-artist', '');
      document.getElementById('player')?.classList.add('no-track');
    } else {
      loadTrack(0);
    }
    wirePlayer();
    wireFilters();

    if (Autonom.isOwner()) {
      document.getElementById('upload-track-controls')?.classList.remove('hidden');
      document.getElementById('upload-track-btn')?.addEventListener('click', uploadTracks);
    }
  }

  // ─── Track helpers ────────────────────────────────────────────────────────────
  function tracks() { return config.tracks || []; }

  // Returns indices of tracks() that pass current filters, in current sort order
  function filteredIndices() {
    let indices = tracks()
      .map((t, i) => i)
      .filter(i => {
        const t = tracks()[i];
        if (filterPlaylist && (t.playlist || '') !== filterPlaylist) return false;
        if (filterAlbum    && (t.album    || '') !== filterAlbum)    return false;
        if (filterArtist   && (t.artist   || '') !== filterArtist)   return false;
        return true;
      });

    if (sortMode !== 'default') {
      indices.sort((a, b) => {
        const ta = tracks()[a], tb = tracks()[b];
        const va = (ta[sortMode] || ta.filename).toLowerCase();
        const vb = (tb[sortMode] || tb.filename).toLowerCase();
        return va.localeCompare(vb);
      });
    }
    return indices;
  }

  // ─── Shuffle order (over filtered set) ───────────────────────────────────────
  function buildShuffleOrder() {
    const fi = filteredIndices();
    shuffleOrder = [...fi];
    for (let i = shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
    }
  }

  function nextIndex() {
    const fi = filteredIndices();
    if (!fi.length) return currentIndex;
    if (shuffleOn) {
      const pos  = shuffleOrder.indexOf(currentIndex);
      return shuffleOrder[(pos + 1) % shuffleOrder.length];
    }
    const pos = fi.indexOf(currentIndex);
    return fi[(pos + 1) % fi.length];
  }

  function prevIndex() {
    const fi = filteredIndices();
    if (!fi.length) return currentIndex;
    if (shuffleOn) {
      const pos = shuffleOrder.indexOf(currentIndex);
      return shuffleOrder[(pos - 1 + shuffleOrder.length) % shuffleOrder.length];
    }
    const pos = fi.indexOf(currentIndex);
    return fi[(pos - 1 + fi.length) % fi.length];
  }

  function isLastInQueue() {
    const fi = filteredIndices();
    if (shuffleOn) return shuffleOrder.indexOf(currentIndex) === shuffleOrder.length - 1;
    return fi.indexOf(currentIndex) === fi.length - 1;
  }

  // ─── Load track ───────────────────────────────────────────────────────────────
  function loadTrack(index) {
    const list = tracks();
    if (!list.length) return;
    currentIndex = Math.max(0, Math.min(index, list.length - 1));
    const t = list[currentIndex];
    audio.src = `assets/music/${t.filename}`;
    setText('track-title',  t.title  || t.filename);
    setText('track-artist', [t.artist, t.album].filter(Boolean).join(' — '));
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

  // ─── Filters ──────────────────────────────────────────────────────────────────
  function populateFilters() {
    const list = tracks();
    const playlists = [...new Set(list.map(t => t.playlist || '').filter(Boolean))].sort();
    const albums    = [...new Set(list.map(t => t.album    || '').filter(Boolean))].sort();
    const artists   = [...new Set(list.map(t => t.artist   || '').filter(Boolean))].sort();

    fillSelect('filter-playlist', playlists, 'All Playlists');
    fillSelect('filter-album',    albums,    'All Albums');
    fillSelect('filter-artist',   artists,   'All Artists');
  }

  function fillSelect(id, values, allLabel) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${allLabel}</option>` +
      values.map(v => `<option value="${escAttr(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  function wireFilters() {
    document.getElementById('filter-playlist')?.addEventListener('change', e => { filterPlaylist = e.target.value; buildShuffleOrder(); renderTrackList(); });
    document.getElementById('filter-album')?.addEventListener('change',    e => { filterAlbum    = e.target.value; buildShuffleOrder(); renderTrackList(); });
    document.getElementById('filter-artist')?.addEventListener('change',   e => { filterArtist   = e.target.value; buildShuffleOrder(); renderTrackList(); });
    document.getElementById('sort-tracks')?.addEventListener('change',     e => { sortMode       = e.target.value; buildShuffleOrder(); renderTrackList(); });
  }

  // ─── Render track list ────────────────────────────────────────────────────────
  function renderTrackList() {
    const el = document.getElementById('track-list');
    if (!el) return;

    const fi      = filteredIndices();
    const isOwner = Autonom.isOwner();
    const canReorder = isOwner && !filterPlaylist && !filterAlbum && !filterArtist && sortMode === 'default';

    if (!fi.length) {
      el.innerHTML = tracks().length
        ? '<p class="music-empty">No tracks match the current filter.</p>'
        : '<p class="music-empty">No tracks yet.</p>';
      return;
    }

    el.innerHTML = fi.map(i => {
      const t = tracks()[i];
      return `
      <div class="track-row${i === currentIndex ? ' track-active' : ''}" data-index="${i}" ${canReorder ? 'draggable="true"' : ''}>
        ${canReorder ? `<span class="drag-handle" aria-hidden="true">&#9776;</span>` : ''}
        <div class="track-row-meta">
          ${isOwner
            ? `<input class="track-edit-title"    data-index="${i}" value="${escAttr(t.title    || '')}" placeholder="Title"    aria-label="Edit title" />
               <input class="track-edit-artist"   data-index="${i}" value="${escAttr(t.artist   || '')}" placeholder="Artist"   aria-label="Edit artist" />
               <input class="track-edit-album"    data-index="${i}" value="${escAttr(t.album    || '')}" placeholder="Album"    aria-label="Edit album" />
               <input class="track-edit-playlist" data-index="${i}" value="${escAttr(t.playlist || '')}" placeholder="Playlist" aria-label="Edit playlist" />`
            : `<span class="track-row-title">${esc(t.title || t.filename)}</span>
               <span class="track-row-artist">${esc([t.artist, t.album].filter(Boolean).join(' — '))}</span>`
          }
        </div>
        <div class="track-row-actions">
          ${canReorder ? `
            <button class="track-move-up" data-index="${i}" aria-label="Move up" ${i === tracks()[0] ? 'disabled' : ''}>&#9650;</button>
            <button class="track-move-dn" data-index="${i}" aria-label="Move down">&#9660;</button>
          ` : ''}
          ${isOwner ? `<button class="remove-track" data-index="${i}" aria-label="Remove ${escAttr(t.title || t.filename)}">&times;</button>` : ''}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.track-row').forEach(row =>
      row.addEventListener('click', e => {
        const skip = ['remove-track','track-move-up','track-move-dn',
                      'track-edit-title','track-edit-artist','track-edit-album',
                      'track-edit-playlist','drag-handle'];
        if (skip.some(c => e.target.classList.contains(c))) return;
        loadTrack(+row.dataset.index);
        audio.play();
        document.getElementById('play-pause').textContent = 'Pause';
      })
    );

    if (isOwner) {
      el.querySelectorAll('.remove-track').forEach(btn =>
        btn.addEventListener('click', () => removeTrack(+btn.dataset.index))
      );
      if (canReorder) {
        el.querySelectorAll('.track-move-up').forEach(btn =>
          btn.addEventListener('click', () => moveTrack(+btn.dataset.index, -1))
        );
        el.querySelectorAll('.track-move-dn').forEach(btn =>
          btn.addEventListener('click', () => moveTrack(+btn.dataset.index, 1))
        );
        wireDragDrop(el);
      }
      el.querySelectorAll('.track-edit-title, .track-edit-artist, .track-edit-album, .track-edit-playlist')
        .forEach(input => {
          input.addEventListener('input', () => {
            const idx = +input.dataset.index;
            clearTimeout(metaTimers[idx]);
            metaTimers[idx] = setTimeout(() => flushTrackMeta(idx), 1500);
          });
        });
    }
  }

  function highlightActive() {
    document.querySelectorAll('.track-row').forEach(row =>
      row.classList.toggle('track-active', +row.dataset.index === currentIndex)
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

  // ─── Save track metadata (debounced, batches all fields per track) ───────────
  async function flushTrackMeta(index) {
    const list = tracks();
    if (!list[index]) return;
    const row = document.querySelector(`.track-row[data-index="${index}"]`);
    if (!row) return;

    const fields = ['title', 'artist', 'album', 'playlist'];
    let changed = false;
    fields.forEach(f => {
      const input = row.querySelector(`.track-edit-${f}`);
      if (!input) return;
      const val = input.value.trim();
      if (list[index][f] !== val) { list[index][f] = val; changed = true; }
    });
    if (!changed) return;

    if (index === currentIndex) {
      setText('track-title',  list[index].title  || list[index].filename);
      setText('track-artist', [list[index].artist, list[index].album].filter(Boolean).join(' — '));
    }
    config.tracks = list;
    config.lastUpdated = new Date().toISOString();
    config.configVersion = (config.configVersion || 1) + 1;
    localStorage.setItem('music-tracks', JSON.stringify(list));
    try {
      await Autonom.commitFile('site-config.json', JSON.stringify(config, null, 2), 'Update track metadata');
    } catch (e) {
      Autonom.toast(`Save failed — ${e.message}`, 'error');
    }
    populateFilters();
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
      if (repeatMode === 'one') { audio.currentTime = 0; audio.play(); return; }
      if (repeatMode === 'all' || !isLastInQueue() || shuffleOn) {
        loadTrack(nextIndex()); audio.play();
        if (playBtn) playBtn.textContent = 'Pause';
      } else {
        if (playBtn) playBtn.textContent = 'Play';
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
    const savedVol = parseFloat(localStorage.getItem('music-volume') ?? '1');
    audio.volume = savedVol;
    if (volBar) volBar.value = savedVol;
    volBar?.addEventListener('input', () => {
      audio.volume = volBar.value;
      localStorage.setItem('music-volume', volBar.value);
    });

    shuffleBtn?.addEventListener('click', () => {
      shuffleOn = !shuffleOn;
      if (shuffleOn) buildShuffleOrder();
      shuffleBtn.classList.toggle('player-btn-active', shuffleOn);
      shuffleBtn.title = shuffleOn ? 'Shuffle: On' : 'Shuffle: Off';
    });

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

    const LIMIT = 50 * 1024 * 1024;
    const tooBig  = files.filter(f => f.size > LIMIT);
    const toUpload = files.filter(f => f.size <= LIMIT);
    if (tooBig.length)
      Autonom.toast(`Skipped (over 50MB): ${tooBig.map(f => f.name).join(', ')}`, 'error');
    if (!toUpload.length) { Autonom.toast('No files to upload', 'error'); return; }

    const btn = document.getElementById('upload-track-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

    const existing = config.tracks || [];
    const added    = [];
    const failed   = [];

    for (const [i, file] of toUpload.entries()) {
      if (btn) btn.textContent = `Uploading ${i + 1} of ${toUpload.length}…`;
      const filename = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
      try {
        const buf = await file.arrayBuffer();
        await Autonom.commitFile(`assets/music/${filename}`, buf, `Upload track ${filename}`, true);
        const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        added.push({ filename, title, artist: '', album: '', playlist: '' });
      } catch {
        failed.push(file.name);
      }
    }
    if (failed.length)
      Autonom.toast(`Failed to upload: ${failed.join(', ')}`, 'error');

    if (btn) btn.textContent = 'Saving…';
    const updatedTracks = [...existing, ...added];
    await Autonom.saveConfig(config, { tracks: updatedTracks }, 'Upload tracks');
    config.tracks = updatedTracks;
    localStorage.setItem('music-tracks', JSON.stringify(updatedTracks));
    buildShuffleOrder();
    populateFilters();
    try { await Autonom.regenerateRSS(config); } catch { /* non-fatal */ }

    renderTrackList();
    Autonom.toast(`${added.length} track${added.length > 1 ? 's' : ''} uploaded — deploying…`, 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Tracks'; }
    fileInput.value = '';
    added.forEach(t => pollDeploy(t.filename));
  }

  // ─── Poll deploy ──────────────────────────────────────────────────────────────
  function pollDeploy(filename) {
    const trackIndex = () => tracks().findIndex(t => t.filename === filename);
    const markRow = label => {
      const i = trackIndex();
      const row = document.querySelector(`.track-row[data-index="${i}"]`);
      if (!row) return;
      let badge = row.querySelector('.deploy-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'deploy-badge';
        row.querySelector('.track-row-actions')?.prepend(badge);
      }
      if (label) badge.textContent = label;
      else badge.remove();
    };

    markRow('⏳ deploying…');
    let attempts = 0;
    const interval = setInterval(async () => {
      if (++attempts > 60) {
        clearInterval(interval);
        markRow('⚠️ deploy timed out');
        return;
      }
      try {
        const res = await fetch(`assets/music/${filename}`, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          clearInterval(interval);
          markRow(null);
          const i = trackIndex();
          if (i !== -1) {
            const label = tracks()[i]?.title || filename;
            loadTrack(i);
            Autonom.toast(`“${label}” ready`, 'success');
          }
        }
      } catch { /* network error, keep polling */ }
    }, 5000);
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
    populateFilters();

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
  function esc(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  init();
})();
