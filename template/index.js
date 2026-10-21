(() => {
  const GITHUB_API = 'https://api.github.com';
  const OWNER = window.Autonom.REPO_OWNER;
  const REPO  = `${OWNER}.github.io`;

  let config = {};

  // ─── GitHub API Helpers ───────────────────────────────────────────────────────
  async function ghGet(path) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Authorization: `token ${Autonom.getToken()}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async function ghPut(path, body) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${Autonom.getToken()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `PUT ${path} failed: ${res.status}`);
    }
    return res.json();
  }

  async function getFileSHA(path) {
    try {
      const data = await ghGet(`/repos/${OWNER}/${REPO}/contents/${path}`);
      return data.sha;
    } catch { return null; }
  }

  async function commitFile(filePath, content, message, isBinary = false) {
    const sha = await getFileSHA(filePath);
    const encoded = isBinary
      ? arrayBufferToBase64(content)
      : btoa(unescape(encodeURIComponent(content)));
    await ghPut(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      message,
      content: encoded,
      ...(sha ? { sha } : {}),
    });
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  // ─── Save site-config.json ────────────────────────────────────────────────────
  async function saveConfig(updates, commitMsg) {
    Object.assign(config, updates);
    config.lastUpdated = new Date().toISOString();
    config.configVersion = (config.configVersion || 1) + 1;
    try {
      await commitFile('site-config.json', JSON.stringify(config, null, 2), commitMsg);
      Autonom.toast('Settings saved', 'success');
    } catch (e) {
      Autonom.toast(`Save failed — ${e.message}`, 'error', () => saveConfig(updates, commitMsg));
    }
  }

  // ─── Image Compression → WebP ─────────────────────────────────────────────────
  function compressToWebP(file, maxKb = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        // Scale down if needed to hit size target
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

  // ─── Favicon generation from profile photo ────────────────────────────────────
  function generateFavicon(imgElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    canvas.getContext('2d').drawImage(imgElement, 0, 0, 32, 32);
    return new Promise(resolve => {
      canvas.toBlob(blob => blob.arrayBuffer().then(resolve), 'image/png');
    });
  }

  // ─── Render config into DOM ───────────────────────────────────────────────────
  function renderConfig() {
    setText('display-name', config.displayName || '');
    setText('bio', config.bio || '');
    setText('status', config.status || '');

    if (config.lastUpdated) {
      const days = Math.floor((Date.now() - new Date(config.lastUpdated)) / 86400000);
      setText('last-updated', days === 0 ? 'Updated today' : `Last updated ${days} day${days !== 1 ? 's' : ''} ago`);
    }

    // Videos
    const grid = document.getElementById('videos-grid');
    if (grid && Array.isArray(config.videos)) {
      grid.innerHTML = config.videos.map(v => `
        <div class="video-item">
          <iframe src="https://www.youtube.com/embed/${youtubeId(v)}"
            title="YouTube video" allowfullscreen
            aria-label="Embedded YouTube video"></iframe>
          <a href="${v}" target="_blank" rel="noopener" aria-label="Watch on YouTube">Watch on YouTube</a>
          ${Autonom.isOwner() ? `<button class="remove-video edit-btn" data-url="${v}" aria-label="Remove video">Remove</button>` : ''}
        </div>`).join('');
      grid.querySelectorAll('.remove-video').forEach(btn =>
        btn.addEventListener('click', () => removeVideo(btn.dataset.url))
      );
    }

    // Customization panel values
    if (Autonom.isOwner()) populateCustomizationPanel();
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function youtubeId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return m ? m[1] : '';
  }

  // ─── OG Tag Rewrite ───────────────────────────────────────────────────────────
  function updateMetaTag(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`)
          || document.querySelector(`meta[name="${property}"]`);
    if (el) el.setAttribute('content', content);
  }

  function applyOGTags() {
    const name = config.displayName || 'My Page';
    const bio  = config.bio || '';
    const img  = `https://${OWNER}.github.io/assets/profile.webp`;
    const url  = `https://${OWNER}.github.io`;
    document.title = `${name}'s Page`;
    updateMetaTag('og:title', `${name}'s Page`);
    updateMetaTag('og:description', bio);
    updateMetaTag('og:image', img);
    updateMetaTag('og:url', url);
    updateMetaTag('twitter:title', `${name}'s Page`);
    updateMetaTag('twitter:description', bio);
    updateMetaTag('twitter:image', img);
  }

  // ─── Profile Photo Upload ─────────────────────────────────────────────────────
  async function handleProfilePhotoUpload(file) {
    if (!file) return;
    try {
      const buffer = await compressToWebP(file);
      await commitFile('assets/profile.webp', buffer, 'Update profile photo', true);

      // Generate and commit favicon from the new photo
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([buffer]));
      img.onload = async () => {
        const faviconBuf = await generateFavicon(img);
        await commitFile('assets/favicon.ico', faviconBuf, 'Update favicon', true);
        URL.revokeObjectURL(img.src);
      };

      document.getElementById('profile-photo').src = URL.createObjectURL(new Blob([buffer], { type: 'image/webp' }));
      Autonom.toast('Profile photo updated', 'success');
    } catch (e) {
      Autonom.toast(`Photo upload failed — ${e.message}`, 'error');
    }
  }

  // ─── Cover Photo Upload ───────────────────────────────────────────────────────
  async function handleCoverPhotoUpload(file) {
    if (!file) return;
    try {
      const buffer = await compressToWebP(file);
      await commitFile('assets/cover.webp', buffer, 'Update cover photo', true);
      document.getElementById('cover-photo').src = URL.createObjectURL(new Blob([buffer], { type: 'image/webp' }));
      Autonom.toast('Cover photo updated', 'success');
    } catch (e) {
      Autonom.toast(`Cover upload failed — ${e.message}`, 'error');
    }
  }

  // ─── Videos ───────────────────────────────────────────────────────────────────
  async function addVideo(url) {
    if (!url || !youtubeId(url)) { Autonom.toast('Invalid YouTube URL', 'error'); return; }
    config.videos = [...(config.videos || []), url];
    await saveConfig({ videos: config.videos }, 'Add video');
    renderConfig();
  }

  async function removeVideo(url) {
    config.videos = (config.videos || []).filter(v => v !== url);
    await saveConfig({ videos: config.videos }, 'Remove video');
    renderConfig();
  }

  // ─── Customization Panel ──────────────────────────────────────────────────────
  function populateCustomizationPanel() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.value = config.theme || 'dark';

    const bgType  = document.getElementById('bg-type');
    const bgColor = document.getElementById('bg-color');
    if (bgType)  bgType.value  = config.background?.type  || 'color';
    if (bgColor) bgColor.value = config.background?.value || '#1a1a2e';

    const customCSS = document.getElementById('custom-css');
    if (customCSS) customCSS.value = config.customCSS || '';

    // Page toggles
    const pages = config.pages || {};
    Object.keys(pages).forEach(key => {
      const el = document.getElementById(`toggle-${key}`);
      if (el) el.checked = pages[key];
    });

    // Mode button label
    const modeBtn = document.getElementById('mode-toggle-btn');
    if (modeBtn) modeBtn.textContent = config.mode === 'business'
      ? 'Switch to Personal Mode'
      : 'Switch to Business Mode';

    // Business form visibility
    const bizForm = document.getElementById('business-profile-form');
    if (bizForm) {
      bizForm.classList.toggle('hidden', config.mode !== 'business');
      if (config.mode === 'business') populateBusinessForm();
    }
  }

  async function saveCustomization() {
    const theme   = document.getElementById('theme-toggle')?.value || 'dark';
    const bgType  = document.getElementById('bg-type')?.value || 'color';
    const bgColor = document.getElementById('bg-color')?.value || '#1a1a2e';
    const bgImage = document.getElementById('bg-image');
    const css     = document.getElementById('custom-css')?.value || '';

    const pages = {};
    ['gallery','music','videos','friends','guestbook','games'].forEach(key => {
      const el = document.getElementById(`toggle-${key}`);
      if (el) pages[key] = el.checked;
    });

    let bgValue = bgColor;
    if (bgType === 'image' && bgImage?.files[0]) {
      const buf = await compressToWebP(bgImage.files[0], 500);
      await commitFile('assets/background.webp', buf, 'Update background image', true);
      bgValue = 'assets/background.webp';
    }

    const updates = {
      theme,
      background: { type: bgType, value: bgValue },
      customCSS: css,
      pages,
    };

    await saveConfig(updates, 'Update customization');
    AutonomTheme.applyTheme(config);

    // Regenerate robots.txt and sitemap on page toggle change
    await regenerateRobots();
    await regenerateSitemap();
  }

  // ─── Business / Personal Mode ─────────────────────────────────────────────────
  async function toggleMode() {
    if (config.mode === 'business') {
      await switchToPersonal();
    } else {
      await switchToBusiness();
    }
  }

  async function switchToBusiness() {
    const confirmed = confirm('This will hide interactive features from visitors. You can switch back anytime.');
    if (!confirmed) return;
    const snapshot = JSON.parse(JSON.stringify(config.pages));
    await saveConfig({
      personalModeSnapshot: snapshot,
      pages: { gallery: true, music: false, videos: true, friends: false, guestbook: false, games: false },
      mode: 'business',
    }, 'Switch to business mode');
    populateCustomizationPanel();
    Autonom.toast('Switched to Business Mode', 'success');
  }

  async function switchToPersonal() {
    const restored = config.personalModeSnapshot || {
      gallery: true, music: true, videos: true, friends: true, guestbook: true, games: true,
    };
    await saveConfig({
      pages: restored,
      personalModeSnapshot: null,
      mode: 'personal',
    }, 'Switch to personal mode');
    populateCustomizationPanel();
    Autonom.toast('Switched to Personal Mode', 'success');
  }

  // ─── Business Profile Form ────────────────────────────────────────────────────
  function populateBusinessForm() {
    const bp = config.businessProfile || {};
    setVal('business-type',       bp.type || '');
    setVal('business-name',       bp.name || '');
    setVal('business-category',   bp.category || '');
    setVal('business-city',       bp.address?.locality || '');
    setVal('business-region',     bp.address?.region || '');
    setVal('business-country',    bp.address?.country || '');
    setVal('business-phone',      bp.phone || '');
    setVal('business-email',      bp.email || '');
    setVal('business-price-range', bp.priceRange || '');
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  async function saveBusinessProfile() {
    const bp = {
      enabled:    true,
      type:       getVal('business-type'),
      name:       getVal('business-name'),
      category:   getVal('business-category'),
      address: {
        locality: getVal('business-city'),
        region:   getVal('business-region'),
        country:  getVal('business-country'),
      },
      phone:      getVal('business-phone'),
      email:      getVal('business-email'),
      priceRange: getVal('business-price-range'),
      services:   config.businessProfile?.services || [],
      hours:      config.businessProfile?.hours || [],
    };

    const jsonLD = generateJSONLD(bp);
    await saveConfig({ businessProfile: bp }, 'Update business profile');
    await rewriteIndexHead(jsonLD);
    Autonom.toast('Business profile saved', 'success');
  }

  function getVal(id) {
    return document.getElementById(id)?.value || '';
  }

  // ─── JSON-LD Generation ───────────────────────────────────────────────────────
  function generateJSONLD(bp) {
    const typeMap = {
      LocalBusiness:       'LocalBusiness',
      ProfessionalService: 'ProfessionalService',
      Restaurant:          'Restaurant',
      Store:               'Store',
      EventVenue:          'EventVenue',
    };
    const schema = {
      '@context': 'https://schema.org',
      '@type':    typeMap[bp.type] || 'LocalBusiness',
      name:       bp.name,
      image:      `https://${OWNER}.github.io/assets/profile.webp`,
      url:        `https://${OWNER}.github.io`,
      telephone:  bp.phone,
      email:      bp.email,
      address: {
        '@type':         'PostalAddress',
        addressLocality: bp.address.locality,
        addressRegion:   bp.address.region,
        addressCountry:  bp.address.country,
      },
      priceRange: bp.priceRange,
    };
    if (bp.hours?.length) schema.openingHoursSpecification = bp.hours;
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n<\/script>`;
  }

  async function rewriteIndexHead(jsonLDBlock) {
    try {
      const data = await ghGet(`/repos/${OWNER}/${REPO}/contents/index.html`);
      let html = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));

      // Remove existing JSON-LD block if present
      html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');

      // Inject new block before </head>
      if (jsonLDBlock) html = html.replace('</head>', `${jsonLDBlock}\n</head>`);

      // Rewrite OG tags
      const name = config.displayName || 'My Page';
      const bio  = config.bio || '';
      html = html
        .replace(/(<meta property="og:title" content=")[^"]*(")/,  `$1${name}'s Page$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${bio}$2`)
        .replace(/(<meta name="twitter:title" content=")[^"]*(")/,  `$1${name}'s Page$2`)
        .replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${bio}$2`);

      await ghPut(`/repos/${OWNER}/${REPO}/contents/index.html`, {
        message: 'Update JSON-LD and OG tags',
        content: btoa(unescape(encodeURIComponent(html))),
        sha: data.sha,
      });
    } catch (e) {
      Autonom.toast(`Failed to update page metadata — ${e.message}`, 'error');
    }
  }

  // ─── Storage Meter ────────────────────────────────────────────────────────────
  async function loadStorageMeter() {
    const meter = document.getElementById('storage-meter');
    if (!meter) return;
    try {
      const data = await ghGet(`/repos/${OWNER}/${REPO}`);
      const kb = data.size;
      const mb = (kb / 1024).toFixed(1);
      const pct = Math.min(100, (kb / (1024 * 1024)) * 100).toFixed(1);
      meter.innerHTML = `
        <p>Storage: <strong>${mb} MB</strong> used</p>
        <progress value="${pct}" max="100" aria-label="Storage usage ${pct}%"></progress>`;
      if (kb > 800 * 1024) Autonom.toast('Storage over 800MB — consider cleaning up old files', 'error');
      else if (kb > 500 * 1024) Autonom.toast('Storage over 500MB', 'error');
    } catch (e) {
      meter.textContent = 'Could not load storage info';
    }
  }

  // ─── QR Code Generator (vanilla JS — no library) ─────────────────────────────
  // Minimal QR using a free API endpoint rendered as an <img> — no JS library needed
  function renderQRCode() {
    const container = document.getElementById('qr-code');
    if (!container) return;
    const pageUrl = encodeURIComponent(`https://${OWNER}.github.io`);
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

  // ─── Share Button ─────────────────────────────────────────────────────────────
  function handleShare() {
    const url = `https://${OWNER}.github.io`;
    navigator.clipboard.writeText(url)
      .then(() => Autonom.toast('Page URL copied to clipboard', 'success'))
      .catch(() => Autonom.toast('Could not copy URL', 'error'));
  }

  // ─── Notifications Badge ──────────────────────────────────────────────────────
  async function loadNotificationsBadge() {
    const badge = document.getElementById('notifications-badge');
    if (!badge || !Autonom.isOwner()) return;
    try {
      const issues = await ghGet(`/repos/${OWNER}/${REPO}/issues?labels=pending-post&state=open`);
      const count = issues.length;
      badge.textContent = count > 0 ? `${count} pending post${count !== 1 ? 's' : ''} awaiting approval` : '';
      badge.setAttribute('aria-label', `${count} pending posts`);
    } catch { badge.textContent = ''; }
  }

  // ─── RSS Generation ───────────────────────────────────────────────────────────
  async function regenerateRSS() {
    const url  = `https://${OWNER}.github.io`;
    const name = config.displayName || OWNER;
    const rss  = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${name}'s Page</title>
    <link>${url}</link>
    <description>${config.bio || ''}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${config.status ? `<item><title>Status Update</title><description>${config.status}</description><pubDate>${new Date().toUTCString()}</pubDate></item>` : ''}
  </channel>
</rss>`;
    await commitFile('rss.xml', rss, 'Regenerate RSS feed');
  }

  // ─── Sitemap Generation ───────────────────────────────────────────────────────
  async function regenerateSitemap() {
    if (!config.directory?.listed) return;
    const base  = `https://${OWNER}.github.io`;
    const pages = config.pages || {};
    const pageFiles = { gallery: 'gallery.html', music: 'music.html', videos: 'videos.html',
                        friends: 'friends.html', guestbook: 'guestbook.html', games: 'games.html' };
    const today = new Date().toISOString().split('T')[0];

    const urls = [`  <url><loc>${base}/</loc><lastmod>${today}</lastmod></url>`];
    Object.entries(pageFiles).forEach(([key, file]) => {
      if (pages[key]) urls.push(`  <url><loc>${base}/${file}</loc><lastmod>${today}</lastmod></url>`);
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    await commitFile('sitemap.xml', xml, 'Regenerate sitemap');

    // Ping Google
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`${base}/sitemap.xml`)}`).catch(() => {});
  }

  // ─── Robots.txt Generation ────────────────────────────────────────────────────
  async function regenerateRobots() {
    const listed = config.directory?.listed !== false;
    const robots = listed ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
    await commitFile('robots.txt', robots, 'Regenerate robots.txt');
  }

  // ─── First-Time Wizard ────────────────────────────────────────────────────────
  async function dismissWizard() {
    document.getElementById('first-time-wizard')?.classList.add('hidden');
    await saveConfig({ firstTimeSetup: false }, 'Dismiss first-time wizard');
  }

  // ─── Wire Up All Events ───────────────────────────────────────────────────────
  function wireEvents() {
    // Profile photo
    document.getElementById('edit-profile-photo')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = e => handleProfilePhotoUpload(e.target.files[0]);
      input.click();
    });

    // Cover photo
    document.getElementById('edit-cover')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = e => handleCoverPhotoUpload(e.target.files[0]);
      input.click();
    });

    // Bio edit
    document.getElementById('edit-bio')?.addEventListener('click', async () => {
      const el = document.getElementById('bio');
      const val = prompt('Edit bio:', el?.textContent || '');
      if (val === null) return;
      el.textContent = val;
      await saveConfig({ bio: val }, 'Update bio');
      await rewriteIndexHead(null);
    });

    // Status edit
    document.getElementById('edit-status')?.addEventListener('click', async () => {
      const el = document.getElementById('status');
      const val = prompt('Edit status:', el?.textContent || '');
      if (val === null) return;
      el.textContent = val;
      await saveConfig({ status: val }, 'Update status');
      await regenerateRSS();
    });

    // Videos
    document.getElementById('edit-videos')?.addEventListener('click', () => {
      const url = prompt('YouTube URL:');
      if (url) addVideo(url);
    });

    // Save customization
    document.getElementById('save-customization')?.addEventListener('click', saveCustomization);

    // Mode toggle
    document.getElementById('mode-toggle-btn')?.addEventListener('click', toggleMode);

    // Business profile save
    document.getElementById('save-business-profile')?.addEventListener('click', saveBusinessProfile);

    // Share
    document.getElementById('share-page')?.addEventListener('click', handleShare);

    // Directory toggle
    document.getElementById('directory-toggle')?.addEventListener('change', async e => {
      await saveConfig({ directory: { listed: e.target.checked } }, 'Update directory listing');
      await regenerateRobots();
      await regenerateSitemap();
    });

    // Custom domain
    document.getElementById('save-custom-domain')?.addEventListener('click', async () => {
      const domain = document.getElementById('custom-domain')?.value?.trim();
      if (!domain) return;
      await saveConfig({ customDomain: domain }, 'Set custom domain');
      await commitFile('CNAME', domain, 'Add CNAME for custom domain');
      Autonom.toast(`Custom domain set to ${domain}`, 'success');
    });

    // Export / backup
    document.getElementById('export-backup')?.addEventListener('click', async () => {
      Autonom.toast('Preparing backup...', 'success');
      window.open(`https://github.com/${OWNER}/${REPO}/archive/refs/heads/main.zip`);
    });

    // Wizard dismiss
    document.getElementById('wizard-dismiss')?.addEventListener('click', dismissWizard);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) {
        config = await res.json();
        // Show stale indicator if SW served cached version
        if (res.headers.get('X-Autonom-Stale') === 'true') {
          Autonom.toast('Viewing a cached version of this page', 'error');
        }
      }
    } catch { /* offline — config stays empty */ }

    renderConfig();
    applyOGTags();
    wireEvents();

    if (Autonom.isOwner()) {
      loadStorageMeter();
      loadNotificationsBadge();
      renderQRCode();

      const dirToggle = document.getElementById('directory-toggle');
      if (dirToggle) dirToggle.checked = config.directory?.listed !== false;

      const domainInput = document.getElementById('custom-domain');
      if (domainInput) domainInput.value = config.customDomain || '';
    }
  }

  init();
})();
