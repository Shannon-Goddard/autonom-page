(() => {
  let config = {};
  const audio = document.getElementById('audio-player');

  // ─── Load config and populate player ─────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) config = await res.json();
    } catch { /* offline */ }

    const track = config.currentTrack || {};

    if (track.filename) {
      audio.src = `assets/music/${track.filename}`;
      setText('track-title',  track.title  || track.filename);
      setText('track-artist', track.artist || '');
      const dl = document.getElementById('download-track');
      if (dl) {
        dl.href     = `assets/music/${track.filename}`;
        dl.download = track.filename;
      }
      document.getElementById('player')?.classList.remove('hidden');
    } else {
      document.getElementById('player')?.classList.add('hidden');
      if (!Autonom.isOwner()) {
        setText('track-title', 'No track uploaded yet.');
      }
    }

    if (Autonom.isOwner()) {
      document.getElementById('upload-track-controls')?.classList.remove('hidden');
      wireUpload();
    }

    wirePlayer();
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

    audio.addEventListener('ended', () => {
      if (playBtn) playBtn.textContent = 'Play';
    });

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      if (seekBar) seekBar.value = (audio.currentTime / audio.duration) * 100;
    });

    seekBar?.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seekBar.value / 100) * audio.duration;
    });

    volBar?.addEventListener('input', () => {
      audio.volume = volBar.value;
    });
  }

  // ─── Upload ───────────────────────────────────────────────────────────────────
  function wireUpload() {
    document.getElementById('upload-track-btn')?.addEventListener('click', uploadTrack);
  }

  async function uploadTrack() {
    const fileInput   = document.getElementById('track-upload');
    const titleInput  = document.getElementById('track-title-input');
    const artistInput = document.getElementById('track-artist-input');
    const file        = fileInput?.files[0];

    if (!file) { Autonom.toast('Select an MP3 first', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) {
      Autonom.toast('File too large — keep MP3s under 20MB', 'error'); return;
    }

    const btn = document.getElementById('upload-track-btn');
    if (btn) btn.disabled = true;

    const filename = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
    const buf      = await file.arrayBuffer();

    await Autonom.commitFile(`assets/music/${filename}`, buf, `Upload track ${filename}`, true);

    const track = {
      filename,
      title:  titleInput?.value.trim()  || filename,
      artist: artistInput?.value.trim() || '',
    };

    await Autonom.saveConfig(config, { currentTrack: track }, 'Update current track');
    await Autonom.regenerateRSS(config);

    // Update player live without reload
    audio.src = `assets/music/${filename}`;
    setText('track-title',  track.title);
    setText('track-artist', track.artist);
    const dl = document.getElementById('download-track');
    if (dl) { dl.href = `assets/music/${filename}`; dl.download = filename; }
    document.getElementById('player')?.classList.remove('hidden');

    Autonom.toast('Track uploaded', 'success');
    if (btn) btn.disabled = false;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  init();
})();
