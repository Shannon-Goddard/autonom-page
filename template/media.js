(() => {
  // ─── Compress image to WebP via Canvas API ────────────────────────────────────
  function compressToWebP(file, maxKb = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const scale = Math.min(1, Math.sqrt((maxKb * 1024) / (width * height * 4)));
        canvas.width  = Math.round(width  * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          blob.arrayBuffer().then(resolve).catch(reject);
        }, 'image/webp', 0.85);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ─── Generate 32x32 favicon from an img element ───────────────────────────────
  function generateFavicon(imgElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    canvas.getContext('2d').drawImage(imgElement, 0, 0, 32, 32);
    return new Promise(resolve => {
      canvas.toBlob(blob => blob.arrayBuffer().then(resolve), 'image/png');
    });
  }

  // ─── Profile photo upload ─────────────────────────────────────────────────────
  async function handleProfilePhotoUpload(file) {
    if (!file) return;
    try {
      const buffer = await compressToWebP(file);
      await Autonom.commitFile('assets/profile.webp', buffer, 'Update profile photo', true);

      const img = new Image();
      const blobUrl = URL.createObjectURL(new Blob([buffer]));
      img.onload = async () => {
        const faviconBuf = await generateFavicon(img);
        await Autonom.commitFile('assets/favicon.ico', faviconBuf, 'Update favicon', true);
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;

      document.getElementById('profile-photo').src = blobUrl;
      Autonom.toast('Profile photo updated', 'success');
    } catch (e) {
      Autonom.toast(`Photo upload failed — ${e.message}`, 'error');
    }
  }

  // ─── Cover photo upload ───────────────────────────────────────────────────────
  async function handleCoverPhotoUpload(file) {
    if (!file) return;
    try {
      const buffer = await compressToWebP(file);
      await Autonom.commitFile('assets/cover.webp', buffer, 'Update cover photo', true);
      document.getElementById('cover-photo').src = URL.createObjectURL(new Blob([buffer], { type: 'image/webp' }));
      Autonom.toast('Cover photo updated', 'success');
    } catch (e) {
      Autonom.toast(`Cover upload failed — ${e.message}`, 'error');
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  Object.assign(window.Autonom, {
    compressToWebP,
    generateFavicon,
    handleProfilePhotoUpload,
    handleCoverPhotoUpload,
  });
})();
