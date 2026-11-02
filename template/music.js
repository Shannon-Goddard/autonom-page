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
      wireR2();
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
    audio.src = t.url || `assets/music/${t.filename}`;
    setText('track-title',  t.title  || t.filename);
    setText('track-artist', [t.artist, t.album].filter(Boolean).join(' — '));
    const dl = document.getElementById('download-track');
    if (dl) { dl.href = t.url || `assets/music/${t.filename}`; dl.download = t.filename; }
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

  // ─── R2 credentials ──────────────────────────────────────────────────────────
  function getR2Creds() {
    try { return JSON.parse(localStorage.getItem('r2-creds') || 'null'); } catch { return null; }
  }
  function saveR2Creds(creds) { localStorage.setItem('r2-creds', JSON.stringify(creds)); }
  function clearR2Creds()     { localStorage.removeItem('r2-creds'); }

  function setR2StatusBar() {
    const bar = document.getElementById('r2-status-bar');
    if (!bar) return;
    const creds = getR2Creds();
    if (creds) {
      bar.textContent = `\u2705 Cloudflare R2 connected \u2014 uploads go to ${creds.publicUrl}`;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  function wireR2() {
    const accordion  = document.getElementById('r2-accordion');
    const toggle     = document.getElementById('r2-accordion-toggle');
    const body       = document.getElementById('r2-accordion-body');
    const chevron    = document.getElementById('r2-accordion-chevron');
    const wizardBtn  = document.getElementById('r2-wizard-btn');
    const wizard     = document.getElementById('r2-wizard');
    const saveBtn    = document.getElementById('r2-wizard-save');
    const cancelBtn  = document.getElementById('r2-wizard-cancel');
    const disconnBtn = document.getElementById('r2-wizard-disconnect');

    if (!accordion) return;
    accordion.classList.remove('hidden');
    setR2StatusBar();

    toggle.addEventListener('click', () => {
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      toggle.setAttribute('aria-expanded', String(!open));
      chevron.innerHTML = open ? '&#9660;' : '&#9650;';
    });

    wizardBtn.addEventListener('click', () => {
      const creds = getR2Creds();
      if (creds) {
        document.getElementById('r2-account-id').value  = creds.accountId;
        document.getElementById('r2-access-key').value  = creds.accessKey;
        document.getElementById('r2-secret-key').value  = creds.secretKey;
        document.getElementById('r2-bucket').value      = creds.bucket;
        document.getElementById('r2-public-url').value  = creds.publicUrl;
        disconnBtn.classList.remove('hidden');
      } else {
        disconnBtn.classList.add('hidden');
      }
      wizard.classList.remove('hidden');
    });

    cancelBtn.addEventListener('click', () => wizard.classList.add('hidden'));
    wizard.addEventListener('click', e => { if (e.target === wizard) wizard.classList.add('hidden'); });

    saveBtn.addEventListener('click', () => {
      const creds = {
        accountId: document.getElementById('r2-account-id').value.trim(),
        accessKey: document.getElementById('r2-access-key').value.trim(),
        secretKey: document.getElementById('r2-secret-key').value.trim(),
        bucket:    document.getElementById('r2-bucket').value.trim(),
        publicUrl: document.getElementById('r2-public-url').value.trim().replace(/\/$/, ''),
      };
      if (!creds.accountId || !creds.accessKey || !creds.secretKey || !creds.bucket || !creds.publicUrl) {
        Autonom.toast('All fields are required', 'error'); return;
      }
      saveR2Creds(creds);
      setR2StatusBar();
      wizard.classList.add('hidden');
      Autonom.toast('Cloudflare R2 connected', 'success');
    });

    disconnBtn.addEventListener('click', () => {
      if (!confirm('Disconnect R2? Future uploads will go to GitHub.')) return;
      clearR2Creds();
      setR2StatusBar();
      wizard.classList.add('hidden');
      Autonom.toast('R2 disconnected', 'success');
    });
  }

  // ─── Upload to R2 via S3-compatible API (AWS Signature V4) ───────────────────
  async function uploadToR2(creds, filename, buf, mimeType) {
    const host   = `${creds.bucket}.${creds.accountId}.r2.cloudflarestorage.com`;
    const url    = `https://${host}/${filename}`;
    const region = 'auto';
    const service = 's3';

    const now    = new Date();
    const date   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ
    const dateStamp = date.slice(0, 8);

    const payloadHash = await sha256Hex(buf);
    const headers = {
      'host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
      'content-type': mimeType,
    };
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join('\n') + '\n';
    const canonicalRequest = ['PUT', `/${filename}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credScope  = `${dateStamp}/${region}/${service}/aws4_request`;
    const strToSign  = ['AWS4-HMAC-SHA256', date, credScope, await sha256Hex(canonicalRequest)].join('\n');
    const signingKey = await hmacKey(
      await hmacKey(await hmacKey(await hmacKey(`AWS4${creds.secretKey}`, dateStamp), region), service), 'aws4_request'
    );
    const signature  = await hmacHex(signingKey, strToSign);
    const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Authorization': authHeader },
      body: buf,
    });
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  }

  async function sha256Hex(data) {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  async function hmacKey(key, data) {
    const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  }
  async function hmacHex(key, data) {
    const buf = await hmacKey(key, data);
    return Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  async function uploadTracks() {
    const fileInput = document.getElementById('track-upload');
    const files     = Array.from(fileInput?.files || []);
    if (!files.length) { Autonom.toast('Select at least one audio file', 'error'); return; }

    const r2 = getR2Creds();
    const LIMIT = r2 ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    const tooBig  = files.filter(f => f.size > LIMIT);
    const toUpload = files.filter(f => f.size <= LIMIT);
    if (tooBig.length)
      Autonom.toast(`Skipped (over ${r2 ? '500MB' : '50MB'}): ${tooBig.map(f => f.name).join(', ')}`, 'error');
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
        if (r2) {
          await uploadToR2(r2, filename, buf, file.type || 'audio/mpeg');
        } else {
          await Autonom.commitFile(`assets/music/${filename}`, buf, `Upload track ${filename}`, true);
        }
        const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const url   = r2 ? `${r2.publicUrl}/${filename}` : null;
        added.push({ filename, title, artist: '', album: '', playlist: '', ...(url ? { url } : {}) });
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
    Autonom.toast(`${added.length} track${added.length > 1 ? 's' : ''} uploaded${r2 ? '' : ' — deploying…'}`, 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Tracks'; }
    fileInput.value = '';
    if (!r2) added.forEach(t => pollDeploy(t.filename));
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

    try {
      if (!t.url) await Autonom.deleteFile(`assets/music/${t.filename}`, `Remove track ${t.filename}`);
    } catch { /* already gone */ }

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
