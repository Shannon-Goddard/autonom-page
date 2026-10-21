(() => {
  async function loadStorageMeter() {
    const meter = document.getElementById('storage-meter');
    if (!meter) return;
    try {
      const data = await Autonom.ghGet(`/repos/${Autonom.OWNER}/${Autonom.REPO}`);
      const kb   = data.size;
      const mb   = (kb / 1024).toFixed(1);
      const pct  = Math.min(100, (kb / (1024 * 1024)) * 100).toFixed(1);
      meter.innerHTML = `
        <p>Storage: <strong>${mb} MB</strong> used</p>
        <progress value="${pct}" max="100" aria-label="Storage usage ${pct}%"></progress>`;
      if      (kb > 800 * 1024) Autonom.toast('Storage over 800MB — consider cleaning up old files', 'error');
      else if (kb > 500 * 1024) Autonom.toast('Storage over 500MB', 'error');
    } catch {
      meter.textContent = 'Could not load storage info';
    }
  }

  function renderQRCode() {
    const container = document.getElementById('qr-code');
    if (!container) return;
    const pageUrl = encodeURIComponent(`https://${Autonom.OWNER}.github.io`);
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${pageUrl}`;
    img.alt = 'QR code for your page';
    img.setAttribute('aria-label', 'QR code linking to your page');

    const dl = document.createElement('a');
    dl.href = img.src;
    dl.download = 'my-page-qr.png';
    dl.textContent = 'Download QR Code';
    dl.setAttribute('aria-label', 'Download QR code as PNG');

    container.innerHTML = '';
    container.appendChild(img);
    container.appendChild(dl);
  }

  function handleShare() {
    const url = `https://${Autonom.OWNER}.github.io`;
    navigator.clipboard.writeText(url)
      .then(()  => Autonom.toast('Page URL copied to clipboard', 'success'))
      .catch(()  => Autonom.toast('Could not copy URL', 'error'));
  }

  async function loadNotificationsBadge() {
    const badge = document.getElementById('notifications-badge');
    if (!badge || !Autonom.isOwner()) return;
    try {
      const issues = await Autonom.ghGet(
        `/repos/${Autonom.OWNER}/${Autonom.REPO}/issues?labels=pending-post&state=open`
      );
      const count = issues.length;
      badge.textContent = count > 0
        ? `${count} pending post${count !== 1 ? 's' : ''} awaiting approval`
        : '';
      badge.setAttribute('aria-label', `${count} pending posts`);
    } catch { badge.textContent = ''; }
  }

  function handleExport() {
    Autonom.toast('Opening backup download...', 'success');
    window.open(`https://github.com/${Autonom.OWNER}/${Autonom.REPO}/archive/refs/heads/main.zip`);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  Object.assign(window.Autonom, {
    loadStorageMeter,
    renderQRCode,
    handleShare,
    loadNotificationsBadge,
    handleExport,
  });
})();
