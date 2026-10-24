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
    const bgColorVal = config.background?.type === 'color' ? (config.background?.value || '#1a1a2e') : '#1a1a2e';
    const swatchEl = document.getElementById('bg-color-swatch');
    const labelEl  = document.getElementById('bg-color-label');
    if (swatchEl) swatchEl.style.background = bgColorVal;
    if (labelEl)  labelEl.textContent = bgColorVal.toUpperCase();
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

    const dirLabel = document.getElementById('directory-label');
    if (dirLabel) dirLabel.textContent = 'List your domain in the directory';

    const domainInput = document.getElementById('custom-domain');
    if (domainInput) domainInput.value = config.customDomain || `${Autonom.REPO_OWNER}.github.io`;
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

  // ─── DNS Helper ───────────────────────────────────────────────────────────────
  function showDNSHelper(domain) {
    const helper  = document.getElementById('dns-helper');
    const intro   = document.getElementById('dns-helper-intro');
    const records = document.getElementById('dns-records');
    if (!helper || !intro || !records) return;

    const isApex = !domain.startsWith('www.');
    const owner  = Autonom.OWNER;

    intro.textContent = isApex
      ? `Point your apex domain (${domain}) to GitHub Pages using these A records:`
      : `Point ${domain} to GitHub Pages using this CNAME record:`;

    if (isApex) {
      const ips = ['185.199.108.153','185.199.109.153','185.199.110.153','185.199.111.153'];
      records.innerHTML = `
        <table class="dns-table" aria-label="DNS A records">
          <thead><tr><th>Type</th><th>Host</th><th>Value</th></tr></thead>
          <tbody>${ips.map(ip =>
            `<tr><td>A</td><td>@</td><td class="dns-val">${ip}</td></tr>`
          ).join('')}</tbody>
        </table>
        <p class="dns-note">Set all four A records. Use <code>@</code> or leave Host blank for apex domains.</p>`;
    } else {
      const sub = domain.split('.')[0];
      records.innerHTML = `
        <table class="dns-table" aria-label="DNS CNAME record">
          <thead><tr><th>Type</th><th>Host</th><th>Value</th></tr></thead>
          <tbody><tr>
            <td>CNAME</td>
            <td>${sub}</td>
            <td class="dns-val">${owner}.github.io</td>
          </tr></tbody>
        </table>
        <p class="dns-note">Set the CNAME value to <code>${owner}.github.io</code>.</p>`;
    }

    helper.classList.remove('hidden');
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
      if (config.mode !== 'business') await Autonom.rewriteIndexHead(config, Autonom.generatePersonJSONLD(config));
      else await Autonom.rewriteIndexHead(config, Autonom.generateJSONLD(config.businessProfile, config));
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

    // Background color picker modal
    (() => {
      const modal    = document.getElementById('color-picker-modal');
      const specCvs  = document.getElementById('cp-spectrum');
      const hueCvs   = document.getElementById('cp-hue');
      const preview  = document.getElementById('cp-preview');
      const hexEl    = document.getElementById('cp-hex');
      const rgbEl    = document.getElementById('cp-rgb');
      const swatch   = document.getElementById('bg-color-swatch');
      const label    = document.getElementById('bg-color-label');
      const hidden   = document.getElementById('bg-color');
      if (!modal || !specCvs) return;

      const sCtx = specCvs.getContext('2d');
      const hCtx = hueCvs.getContext('2d');
      let hue = 0, draggingSpec = false, draggingHue = false;

      function drawSpectrum(h) {
        const w = specCvs.width, v = specCvs.height;
        const gH = sCtx.createLinearGradient(0,0,w,0);
        gH.addColorStop(0, '#fff'); gH.addColorStop(1, `hsl(${h},100%,50%)`);
        sCtx.fillStyle = gH; sCtx.fillRect(0,0,w,v);
        const gV = sCtx.createLinearGradient(0,0,0,v);
        gV.addColorStop(0,'rgba(0,0,0,0)'); gV.addColorStop(1,'rgba(0,0,0,1)');
        sCtx.fillStyle = gV; sCtx.fillRect(0,0,w,v);
      }

      function drawHue() {
        const w = hueCvs.width, h = hueCvs.height;
        const g = hCtx.createLinearGradient(0,0,w,0);
        for (let i = 0; i <= 360; i += 30) g.addColorStop(i/360, `hsl(${i},100%,50%)`);
        hCtx.fillStyle = g; hCtx.fillRect(0,0,w,h);
      }

      function toHex(r,g,b) {
        return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0').toUpperCase()).join('');
      }

      function applyColor(r,g,b) {
        const hex = toHex(r,g,b);
        const rgb = `rgb(${r}, ${g}, ${b})`;
        preview.style.background = hex;
        hexEl.textContent = hex;
        rgbEl.textContent = rgb;
      }

      function sampleSpec(e) {
        const rect = specCvs.getBoundingClientRect();
        const sx = specCvs.width / rect.width, sy = specCvs.height / rect.height;
        const x = Math.max(0, Math.min(Math.round((e.clientX - rect.left)*sx), specCvs.width-1));
        const y = Math.max(0, Math.min(Math.round((e.clientY - rect.top)*sy),  specCvs.height-1));
        const px = sCtx.getImageData(x, y, 1, 1).data;
        applyColor(px[0], px[1], px[2]);
      }

      function sampleHue(e) {
        const rect = hueCvs.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        hue = Math.round((x / rect.width) * 360);
        drawSpectrum(hue);
      }

      specCvs.addEventListener('mousedown',  e => { draggingSpec = true; sampleSpec(e); });
      hueCvs.addEventListener('mousedown',   e => { draggingHue  = true; sampleHue(e); });
      specCvs.addEventListener('click', sampleSpec);
      hueCvs.addEventListener('click',  sampleHue);
      specCvs.addEventListener('touchstart', e => { draggingSpec = true; sampleSpec(e.touches[0]); }, { passive: true });
      hueCvs.addEventListener('touchstart',  e => { draggingHue  = true; sampleHue(e.touches[0]); },  { passive: true });
      specCvs.addEventListener('touchmove',  e => { if (draggingSpec) sampleSpec(e.touches[0]); }, { passive: true });
      hueCvs.addEventListener('touchmove',   e => { if (draggingHue)  sampleHue(e.touches[0]); },  { passive: true });
      document.addEventListener('mousemove', e => { if (draggingSpec) sampleSpec(e); if (draggingHue) sampleHue(e); });
      document.addEventListener('mouseup',   () => { draggingSpec = false; draggingHue = false; });
      document.addEventListener('touchend',  () => { draggingSpec = false; draggingHue = false; });

      // Open modal
      document.getElementById('bg-color-btn')?.addEventListener('click', () => {
        drawHue();
        drawSpectrum(hue);
        // Seed with current saved color
        const cur = hidden.value || '#1a1a2e';
        const r = parseInt(cur.slice(1,3),16), g = parseInt(cur.slice(3,5),16), b = parseInt(cur.slice(5,7),16);
        applyColor(r, g, b);
        modal.classList.remove('hidden');
      });

      // Apply
      document.getElementById('cp-apply')?.addEventListener('click', () => {
        const hex = hexEl.textContent;
        hidden.value = hex;
        swatch.style.background = hex;
        label.textContent = hex;
        modal.classList.add('hidden');
      });

      // Close
      document.getElementById('color-picker-close')?.addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.add('hidden'); });

      // Click value to copy
      hexEl.addEventListener('click', () => navigator.clipboard?.writeText(hexEl.textContent).then(() => Autonom.toast(`Copied ${hexEl.textContent}`, 'success')));
      rgbEl.addEventListener('click', () => navigator.clipboard?.writeText(rgbEl.textContent).then(() => Autonom.toast(`Copied ${rgbEl.textContent}`, 'success')));
    })();

    // Background type toggle
    const bgType  = document.getElementById('bg-type');
    const bgColor = document.getElementById('bg-color');
    const bgImage = document.getElementById('bg-image');
    function syncBgInputs() {
      const t = bgType?.value;
      bgColor?.classList.toggle('hidden', t !== 'color');
      bgImage?.classList.toggle('hidden', t !== 'image');
    }
    bgType?.addEventListener('change', syncBgInputs);
    syncBgInputs();

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
      const domain = document.getElementById('custom-domain')?.value?.trim().toLowerCase();
      if (!domain) return;
      await Autonom.saveConfig(config, { customDomain: domain }, 'Set custom domain');
      await Autonom.commitFile('CNAME', domain, 'Add CNAME for custom domain');
      Autonom.toast(`Custom domain set to ${domain}`, 'success');
      showDNSHelper(domain);
    });

    // Verify DNS
    document.getElementById('verify-dns')?.addEventListener('click', async () => {
      const domain = document.getElementById('custom-domain')?.value?.trim();
      const result = document.getElementById('dns-verify-result');
      if (!domain || !result) return;
      result.textContent = 'Checking...';
      result.className = '';
      try {
        await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
        result.textContent = '\u2713 Domain is resolving. GitHub Pages may still be building \u2014 check back in a few minutes if the site isn\'t live yet.';
        result.className = 'dns-ok';
      } catch {
        result.textContent = '\u2717 Domain not resolving yet \u2014 DNS changes can take up to 48 hours to propagate.';
        result.className = 'dns-fail';
      }
    });

    // Show DNS helper if domain already set
    if (config.customDomain) showDNSHelper(config.customDomain);

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
      ['gallery','music','videos','friends','guestbook','games'].forEach(k => {
        const el = document.getElementById(`wiz-${k}`);
        if (el) pages[k] = el.checked;
      });
      const updates = { firstTimeSetup: false, pages: { ...config.pages, ...pages } };
      if (status) { updates.status = status; setText('status', status); }
      await Autonom.saveConfig(config, updates, 'First-time setup');
      if (status) await Autonom.regenerateRSS(config);
      await Autonom.regenerateSitemap(config);
      document.getElementById('first-time-wizard')?.classList.add('hidden');
      Autonom.toast('Page set up \u2014 looking good!', 'success');
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
      // Ensure JSON-LD is present — inject silently if missing
      if (config.mode !== 'business') {
        Autonom.rewriteIndexHead(config, Autonom.generatePersonJSONLD(config)).catch(() => {});
      }
      if (config.firstTimeSetup) {
        document.getElementById('first-time-wizard')?.classList.remove('hidden');
      }
    }
  }

  init();
})();
