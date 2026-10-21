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
        const url   = input?.value.trim();
        if (url) { addVideo(url); input.value = ''; }
      });
      document.getElementById('video-url-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('add-video-btn')?.click();
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
  async function addVideo(url) {
    if (!youtubeId(url)) { Autonom.toast('Invalid YouTube URL', 'error'); return; }
    config.videos = [...(config.videos || []), url];
    await Autonom.saveConfig(config, { videos: config.videos }, 'Add video');
    renderVideos();
    Autonom.toast('Video added', 'success');
  }

  async function removeVideo(url) {
    config.videos = (config.videos || []).filter(v => v !== url);
    await Autonom.saveConfig(config, { videos: config.videos }, 'Remove video');
    renderVideos();
    Autonom.toast('Video removed', 'success');
  }

  init();
})();
