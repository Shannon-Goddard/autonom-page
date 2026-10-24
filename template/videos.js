(() => {
  let config = {};

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) config = await res.json();
    } catch { /* offline */ }

    renderVideos();

    if (Autonom.isOwner()) {
      document.getElementById('add-video-controls')?.classList.remove('hidden');
      document.getElementById('add-video-btn')?.addEventListener('click', () => {
        const input = document.getElementById('video-url-input');
        const urls  = (input?.value || '').split('\n').map(u => u.trim()).filter(Boolean);
        if (urls.length) { addVideos(urls); input.value = ''; }
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function youtubeId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return m ? m[1] : '';
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function renderVideos() {
    const grid = document.getElementById('videos-grid');
    if (!grid) return;

    const videos = config.videos || [];
    if (!videos.length) {
      grid.innerHTML = '<p class="videos-empty">No videos yet.</p>';
      return;
    }

    grid.innerHTML = videos.map(url => {
      const id = youtubeId(url);
      if (!id) return '';
      return `
        <div class="video-item">
          <div class="video-embed-wrap">
            <iframe src="https://www.youtube.com/embed/${id}"
              title="YouTube video" allowfullscreen
              aria-label="Embedded YouTube video"></iframe>
          </div>
          <div class="video-item-footer">
            <a href="${url}" target="_blank" rel="noopener"
              aria-label="Watch on YouTube">Watch on YouTube ↗</a>
            ${Autonom.isOwner()
              ? `<button class="remove-video edit-btn" data-url="${url}"
                  aria-label="Remove video">Remove</button>`
              : ''}
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.remove-video').forEach(btn =>
      btn.addEventListener('click', () => removeVideo(btn.dataset.url))
    );
  }

  // ─── Add / Remove ─────────────────────────────────────────────────────────────
  async function addVideos(urls) {
    const valid   = urls.filter(u => youtubeId(u));
    const invalid = urls.length - valid.length;
    if (!valid.length) { Autonom.toast('No valid YouTube URLs found', 'error'); return; }
    if (invalid) Autonom.toast(`${invalid} invalid URL${invalid > 1 ? 's' : ''} skipped`, 'error');
    config.videos = [...(config.videos || []), ...valid];
    await Autonom.saveConfig(config, { videos: config.videos }, 'Add videos');
    renderVideos();
    Autonom.toast(`${valid.length} video${valid.length > 1 ? 's' : ''} added`, 'success');
  }

  async function removeVideo(url) {
    config.videos = (config.videos || []).filter(v => v !== url);
    await Autonom.saveConfig(config, { videos: config.videos }, 'Remove video');
    renderVideos();
    Autonom.toast('Video removed', 'success');
  }

  init();
})();
