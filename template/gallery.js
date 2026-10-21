(() => {
  let photos = []; // [{ name, url }]

  // ─── Fetch photo list from repo ───────────────────────────────────────────────
  async function loadPhotos() {
    try {
      const items = await Autonom.ghGet(`/repos/${Autonom.OWNER}/${Autonom.OWNER}.github.io/contents/assets/gallery`);
      photos = items
        .filter(f => f.name.endsWith('.webp'))
        .map(f => ({ name: f.name, url: f.download_url }));
    } catch {
      photos = [];
    }
    renderGallery();
  }

  // ─── Render grid ──────────────────────────────────────────────────────────────
  function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    if (!photos.length) {
      grid.innerHTML = '<p class="gallery-empty">No photos yet.</p>';
      return;
    }

    grid.innerHTML = photos.map(p => `
      <figure class="gallery-item">
        <img src="${p.url}" alt="Gallery photo ${p.name}" loading="lazy" />
        ${Autonom.isOwner() ? `<button class="delete-photo edit-btn" data-name="${p.name}" aria-label="Delete ${p.name}">&times;</button>` : ''}
      </figure>`).join('');

    grid.querySelectorAll('.delete-photo').forEach(btn =>
      btn.addEventListener('click', () => deletePhoto(btn.dataset.name))
    );
  }

  // ─── Upload ───────────────────────────────────────────────────────────────────
  async function uploadPhotos(files) {
    if (!files.length) return;
    const btn = document.getElementById('upload-btn');
    if (btn) btn.disabled = true;

    for (const file of files) {
      const buf  = await Autonom.compressToWebP(file, 200);
      const name = `${Date.now()}-${file.name.replace(/\.[^.]+$/, '')}.webp`;
      await Autonom.commitFile(`assets/gallery/${name}`, buf, `Add gallery photo ${name}`, true);
      photos.push({ name, url: `assets/gallery/${name}` });
    }

    renderGallery();
    Autonom.toast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`, 'success');
    if (btn) btn.disabled = false;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────
  async function deletePhoto(name) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      const sha = await Autonom.getFileSHA(`assets/gallery/${name}`);
      await Autonom.ghDelete(
        `/repos/${Autonom.OWNER}/${Autonom.OWNER}.github.io/contents/assets/gallery/${name}`,
        { message: `Delete gallery photo ${name}`, sha }
      );
      photos = photos.filter(p => p.name !== name);
      renderGallery();
      Autonom.toast('Photo deleted', 'success');
    } catch {
      Autonom.toast('Delete failed', 'error');
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    if (Autonom.isOwner()) {
      document.getElementById('upload-controls')?.classList.remove('hidden');
      document.getElementById('upload-btn')?.addEventListener('click', () => {
        const input = document.getElementById('photo-upload');
        if (input?.files.length) uploadPhotos(Array.from(input.files));
      });
    }
    loadPhotos();
  }

  init();
})();
