(() => {
  let config = {};

  // ─── Render config into DOM ───────────────────────────────────────────────────
  function renderConfig() {
    setText('display-name', config.displayName || '');
    setText('bio',          config.bio         || '');
    setText('status',       config.status      || '');

    if (config.lastUpdated) {
      const days = Math.floor((Date.now() - new Date(config.lastUpdated)) / 86400000);
      setText('last-updated', days === 0
        ? 'Updated today'
        : `Last updated ${days} day${days !== 1 ? 's' : ''} ago`);
    }

    renderVideos();
    applyOGTags();

    if (Autonom.isOwner()) populateCustomizationPanel();
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── Videos ───────────────────────────────────────────────────────────────────
  function youtubeId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return m ? m[1] : '';
  }

  function renderVideos() {
    const grid = document.getElementById('videos-grid');
    if (!grid || !Array.isArray(config.videos)) return;
    grid.innerHTML = config.videos.map(v => `
      <div class="video-item">
        <iframe src="https://www.youtube.com/embed/${youtubeId(v)}"
          title="YouTube video" allowfullscreen aria-label="Embedded YouTube video"></iframe>
        <a href="${v}" target="_blank" rel="noopener" aria-label="Watch on YouTube">Watch on YouTube</a>
        ${Autonom.isOwner() ? `<button class="remove-video edit-btn" data-url="${v}" aria-label="Remove video">Remove</button>` : ''}
      </div>`).join('');
    grid.querySelectorAll('.remove-video').forEach(btn =>
      btn.addEventListener('click', () => removeVideo(btn.dataset.url))
    );
  }

  async function addVideo(url) {
    if (!url || !youtubeId(url)) { Autonom.toast('Invalid YouTube URL', 'error'); return; }
    config.videos = [...(config.videos || []), url];
    await Autonom.saveConfig(config, { videos: config.videos }, 'Add video');
    renderVideos();
  }

  async function removeVideo(url) {
    config.videos = (config.videos || []).filter(v => v !== url);
    await Autonom.saveConfig(config, { videos: config.videos }, 'Remove video');
    renderVideos();
  }

  // ─── OG Tags ──────────────────────────────────────────────────────────────────
  function applyOGTags() {
    const name = config.displayName || 'My Page';
    const bio  = config.bio || '';
    const img  = `https://${Autonom.OWNER}.github.io/assets/profile.webp`;
    const url  = `https://${Autonom.OWNER}.github.io`;
    document.title = `${name}'s Page`;
    setMeta('og:title',            `${name}'s Page`);
    setMeta('og:description',      bio);
    setMeta('og:image',            img);
    setMeta('og:url',              url);
    setMeta('twitter:title',       `${name}'s Page`);
    setMeta('twitter:description', bio);
    setMeta('twitter:image',       img);
  }

  function setMeta(prop, content) {
    const el = document.querySelector(`meta[property="${prop}"]`)
            || document.querySelector(`meta[name="${prop}"]`);
    if (el) el.setAttribute('content', content);
  }

  // ─── Customization Panel ──────────────────────────────────────────────────────
  function populateCustomizationPanel() {
    setVal('theme-toggle', config.theme || 'dark');
    setVal('bg-type',      config.background?.type  || 'color');
    setVal('bg-color',     config.background?.value || '#1a1a2e');
    setVal('custom-css',   config.customCSS || '');

    const pages = config.pages || {};
    Object.keys(pages).forEach(key => {
      const el = document.getElementById(`toggle-${key}`);
      if (el) el.checked = pages[key];
    });

    const modeBtn = document.getElementById('mode-toggle-btn');
    if (modeBtn) modeBtn.textContent = config.mode === 'business'
      ? 'Switch to Personal Mode'
      : 'Switch to Business Mode';

    const bizForm = document.getElementById('business-profile-form');
    if (bizForm) {
      bizForm.classList.toggle('hidden', config.mode !== 'business');
      if (config.mode === 'business') Autonom.populateBusinessForm(config);
    }

    const dirToggle = document.getElementById('directory-toggle');
    if (dirToggle) dirToggle.checked = config.directory?.listed !== false;

    const domainInput = document.getElementById('custom-domain');
    if (domainInput) domainInput.value = config.customDomain || '';
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // ─── Save Customization ───────────────────────────────────────────────────────
  async function saveCustomization() {
    const theme  = document.getElementById('theme-toggle')?.value || 'dark';
    const bgType = document.getElementById('bg-type')?.value      || 'color';
    const bgColor= document.getElementById('bg-color')?.value     || '#1a1a2e';
    const bgImage= document.getElementById('bg-image');
    const css    = document.getElementById('custom-css')?.value   || '';

    const pages = {};
    ['gallery','music','videos','friends','guestbook','games'].forEach(key => {
      const el = document.getElementById(`toggle-${key}`);
      if (el) pages[key] = el.checked;
    });

    let bgValue = bgColor;
    if (bgType === 'image' && bgImage?.files[0]) {
      const buf = await Autonom.compressToWebP(bgImage.files[0], 500);
      await Autonom.commitFile('assets/background.webp', buf, 'Update background image', true);
      bgValue = 'assets/background.webp';
    }

    await Autonom.saveConfig(config, {
      theme,
      background: { type: bgType, value: bgValue },
      customCSS: css,
      pages,
    }, 'Update customization');

    AutonomTheme.applyTheme(config);
    await Autonom.regenerateRobots(config);
    await Autonom.regenerateSitemap(config);
  }

  // ─── Mode Toggle ──────────────────────────────────────────────────────────────
  async function toggleMode() {
    if (config.mode === 'business') {
      const restored = config.personalModeSnapshot || {
        gallery: true, music: true, videos: true, friends: true, guestbook: true, games: true,
      };
      await Autonom.saveConfig(config, {
        pages: restored, personalModeSnapshot: null, mode: 'personal',
      }, 'Switch to personal mode');
      Autonom.toast('Switched to Personal Mode', 'success');
    } else {
      const confirmed = confirm('This will hide interactive features from visitors. You can switch back anytime.');
      if (!confirmed) return;
      await Autonom.saveConfig(config, {
        personalModeSnapshot: JSON.parse(JSON.stringify(config.pages)),
        pages: { gallery: true, music: false, videos: true, friends: false, guestbook: false, games: false },
        mode: 'business',
      }, 'Switch to business mode');
      Autonom.toast('Switched to Business Mode', 'success');
    }
    populateCustomizationPanel();
  }

  // ─── Wire Events ──────────────────────────────────────────────────────────────
  function wireEvents() {
    // Profile photo
    document.getElementById('edit-profile-photo')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = e => Autonom.handleProfilePhotoUpload(e.target.files[0]);
      input.click();
    });

    // Cover photo
    document.getElementById('edit-cover')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = e => Autonom.handleCoverPhotoUpload(e.target.files[0]);
      input.click();
    });

    // Bio
    document.getElementById('edit-bio')?.addEventListener('click', async () => {
      const el  = document.getElementById('bio');
      const val = prompt('Edit bio:', el?.textContent || '');
      if (val === null) return;
      el.textContent = val;
      await Autonom.saveConfig(config, { bio: val }, 'Update bio');
      await Autonom.rewriteIndexHead(config, null);
    });

    // Status
    document.getElementById('edit-status')?.addEventListener('click', async () => {
      const el  = document.getElementById('status');
      const val = prompt('Edit status:', el?.textContent || '');
      if (val === null) return;
      el.textContent = val;
      await Autonom.saveConfig(config, { status: val }, 'Update status');
      await Autonom.regenerateRSS(config);
    });

    // Videos
    document.getElementById('edit-videos')?.addEventListener('click', () => {
      const url = prompt('YouTube URL:');
      if (url) addVideo(url);
    });

    // Customization
    document.getElementById('save-customization')?.addEventListener('click', saveCustomization);

    // Mode
    document.getElementById('mode-toggle-btn')?.addEventListener('click', toggleMode);

    // Business profile
    document.getElementById('save-business-profile')?.addEventListener('click', () =>
      Autonom.saveBusinessProfile(config)
    );

    // Share
    document.getElementById('share-page')?.addEventListener('click', Autonom.handleShare);

    // Export
    document.getElementById('export-backup')?.addEventListener('click', Autonom.handleExport);

    // Directory toggle
    document.getElementById('directory-toggle')?.addEventListener('change', async e => {
      await Autonom.saveConfig(config, { directory: { listed: e.target.checked } }, 'Update directory listing');
      await Autonom.regenerateRobots(config);
      await Autonom.regenerateSitemap(config);
      await Autonom.syncDirectory(config);
    });

    // Custom domain
    document.getElementById('save-custom-domain')?.addEventListener('click', async () => {
      const domain = document.getElementById('custom-domain')?.value?.trim();
      if (!domain) return;
      await Autonom.saveConfig(config, { customDomain: domain }, 'Set custom domain');
      await Autonom.commitFile('CNAME', domain, 'Add CNAME for custom domain');
      Autonom.toast(`Custom domain set to ${domain}`, 'success');
    });

    // Wizard dismiss
    document.getElementById('wizard-dismiss')?.addEventListener('click', async () => {
      document.getElementById('first-time-wizard')?.classList.add('hidden');
      await Autonom.saveConfig(config, { firstTimeSetup: false }, 'Dismiss setup wizard');
    });

    // Wizard save
    document.getElementById('wizard-cover-btn')?.addEventListener('click', () =>
      document.getElementById('wizard-cover-input')?.click()
    );
    document.getElementById('wizard-cover-input')?.addEventListener('change', e => {
      if (e.target.files[0]) Autonom.handleCoverPhotoUpload(e.target.files[0]);
    });
    document.getElementById('wizard-save')?.addEventListener('click', async () => {
      const status = document.getElementById('wizard-status')?.value.trim();
      const pages  = {};
      ['gallery','music','friends','guestbook','games'].forEach(k => {
        const el = document.getElementById(`wiz-${k}`);
        if (el) pages[k] = el.checked;
      });
      const updates = { firstTimeSetup: false, pages: { ...config.pages, ...pages } };
      if (status) { updates.status = status; setText('status', status); }
      await Autonom.saveConfig(config, updates, 'First-time setup');
      if (status) await Autonom.regenerateRSS(config);
      await Autonom.regenerateSitemap(config);
      document.getElementById('first-time-wizard')?.classList.add('hidden');
      Autonom.toast('Page set up — looking good!', 'success');
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (res.ok) {
        config = await res.json();
        if (res.headers.get('X-Autonom-Stale') === 'true') {
          Autonom.toast('Viewing a cached version of this page', 'error');
        }
      }
    } catch { /* offline */ }

    renderConfig();
    wireEvents();

    if (Autonom.isOwner()) {
      Autonom.loadStorageMeter();
      Autonom.loadNotificationsBadge();
      Autonom.renderQRCode();
      if (config.firstTimeSetup) {
        document.getElementById('first-time-wizard')?.classList.remove('hidden');
      }
    }
  }

  init();
})();
