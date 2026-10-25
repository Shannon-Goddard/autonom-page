(() => {
  let config = {};
  let friends = [];

  // ─── Render config into DOM ───────────────────────────────────────────────────
  function renderConfig() {
    setText('display-name', config.displayName || '');
    setText('bio',          config.bio         || '');
    setText('status',       config.status      || '');
    setText('about-bio',    config.bio         || '');
    setText('about-status', config.status      || '');

    if (config.lastUpdated) {
      const days = Math.floor((Date.now() - new Date(config.lastUpdated)) / 86400000);
      const label = days === 0 ? 'Updated today' : `Last updated ${days} day${days !== 1 ? 's' : ''} ago`;
      setText('last-updated',  label);
      setText('about-updated', label);
    }

    const domain = config.customDomain || `${Autonom.OWNER}.github.io`;
    const domainEl = document.getElementById('about-domain');
    if (domainEl) {
      domainEl.href = `https://${domain}`;
      domainEl.textContent = domain;
      domainEl.classList.remove('hidden');
    }

    buildTabBar();
    applyOGTags();
    renderLeftColumn();
    renderHomepageSections();

    if (Autonom.isOwner()) {
      populateCustomizationPanel();
      document.getElementById('edit-profile-btn')?.classList.remove('hidden');
      document.getElementById('edit-cover')?.classList.remove('hidden');
      document.getElementById('profile-photo-wrap')?.classList.add('owner');
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── Tab Bar ──────────────────────────────────────────────────────────────────
  function buildTabBar() {
    const bar   = document.getElementById('profile-tabs');
    if (!bar) return;
    const pages = config.pages || {};
    const PAGE_DEFS = [
      { key: 'gallery',   label: 'Photos',    href: 'gallery.html' },
      { key: 'music',     label: 'Music',     href: 'music.html' },
      { key: 'videos',    label: 'Videos',    href: 'videos.html' },
      { key: 'friends',   label: 'Friends',   href: 'friends.html' },
      { key: 'guestbook', label: 'Guestbook', href: 'guestbook.html' },
      { key: 'games',     label: 'Games',     href: 'games.html' },
    ];
    // Remove any previously built tabs except #tab-all
    bar.querySelectorAll('.profile-tab:not(#tab-all)').forEach(t => t.remove());
    PAGE_DEFS.forEach(({ key, label, href }) => {
      if (!pages[key]) return;
      const a = document.createElement('a');
      a.href = href;
      a.className = 'profile-tab';
      a.textContent = label;
      a.setAttribute('aria-label', `Go to ${label} page`);
      bar.appendChild(a);
    });
  }

  // ─── Left Column ──────────────────────────────────────────────────────────────
  function renderLeftColumn() {
    if (config.mode === 'business') {
      renderBusinessCard();
      document.getElementById('friends-preview')?.classList.add('hidden');
    } else {
      document.getElementById('business-card')?.classList.add('hidden');
      renderFriendsCircles();
    }
  }

  function renderBusinessCard() {
    const bp  = config.businessProfile || {};
    const card = document.getElementById('business-card');
    if (!card) return;
    setText('biz-card-name',     bp.name     || config.displayName || '');
    setText('biz-card-category', bp.category || '');
    const loc = [bp.address?.locality, bp.address?.region, bp.address?.country].filter(Boolean).join(', ');
    setText('biz-card-location', loc);
    setText('biz-card-price',    bp.priceRange ? `Price range: ${bp.priceRange}` : '');

    // Hours — show today's hours if available
    if (Array.isArray(bp.hours) && bp.hours.length) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const today = bp.hours.find(h => h.day === days[new Date().getDay()]);
      setText('biz-card-hours', today
        ? (today.closed ? 'Closed today' : `Today: ${today.open} – ${today.close}`)
        : '');
    }

    const phoneEl = document.getElementById('biz-card-phone');
    if (phoneEl && bp.phone) {
      phoneEl.href = `tel:${bp.phone}`;
      phoneEl.textContent = bp.phone;
      phoneEl.classList.remove('hidden');
    }
    const emailEl = document.getElementById('biz-card-email');
    if (emailEl && bp.email) {
      emailEl.href = `mailto:${bp.email}`;
      emailEl.textContent = bp.email;
      emailEl.classList.remove('hidden');
    }
    card.classList.remove('hidden');
  }

  function renderFriendsCircles() {
    const wrap = document.getElementById('friends-preview');
    const grid = document.getElementById('friends-circles');
    if (!wrap || !grid) return;

    fetch('friends.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        friends = list;
        wrap.classList.remove('hidden');

        if (!list.length) {
          grid.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'friends-empty-state';
          if (Autonom.isOwner()) {
            empty.innerHTML = `
              <p>Add friends by username — anyone on Autonom has a page at <code>username.github.io</code></p>
              <div class="friends-quick-add">
                <input type="text" id="friends-quick-input" placeholder="username or URL" aria-label="Friend username or URL" />
                <button id="friends-quick-btn" aria-label="Add friend">Add</button>
              </div>`;
            wrap.appendChild(empty);
            document.getElementById('friends-quick-btn')?.addEventListener('click', quickAddFriend);
            document.getElementById('friends-quick-input')?.addEventListener('keydown', e => {
              if (e.key === 'Enter') quickAddFriend();
            });
          } else {
            empty.textContent = 'No friends added yet.';
            wrap.appendChild(empty);
          }
          return;
        }

        // remove any previous empty state
        wrap.querySelector('.friends-empty-state')?.remove();

        const show = list.slice(0, 9);
        grid.innerHTML = show.map((f, i) => `
          <a href="${f.url}" target="_blank" rel="noopener"
            class="friend-circle${Autonom.isOwner() ? ' draggable-friend' : ''}"
            data-index="${i}" aria-label="${f.displayName}"
            ${Autonom.isOwner() ? 'draggable="true"' : ''}>
            <img src="${f.photo}" alt="${f.displayName}" loading="lazy"
              onerror="this.src='assets/profile.webp'" />
            <span>${f.displayName}</span>
            ${Autonom.isOwner() ? `
              <button class="friend-move-up" data-index="${i}" aria-label="Move ${f.displayName} up" title="Move up">&#8679;</button>
              <button class="friend-move-dn" data-index="${i}" aria-label="Move ${f.displayName} down" title="Move down">&#8681;</button>
            ` : ''}
          </a>`).join('');

        const seeAll = document.getElementById('friends-see-all');
        if (seeAll) seeAll.classList.toggle('hidden', list.length <= 9);

        if (Autonom.isOwner()) wireFriendReorder(grid);
      })
      .catch(() => { wrap?.classList.add('hidden'); });
  }

  // ─── Quick Add Friend (empty state) ─────────────────────────────────────────
  async function quickAddFriend() {
    const input = document.getElementById('friends-quick-input');
    const raw = input?.value.trim();
    if (!raw) return;
    const url = normaliseUrl(raw);
    if (friends.some(f => f.url === url)) { Autonom.toast('Already added', 'error'); return; }
    const btn = document.getElementById('friends-quick-btn');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const cfg = await fetch(`${url}/site-config.json`).then(r => r.ok ? r.json() : {});
      const owner = url.replace('https://', '').split('.')[0];
      friends.push({
        url,
        displayName: cfg.displayName || owner,
        photo: `${url}/assets/profile.webp`,
      });
      await saveFriends('Add friend');
      Autonom.toast(`${cfg.displayName || owner} added!`, 'success');
      renderFriendsCircles();
    } catch {
      Autonom.toast('Could not fetch that profile — check the username', 'error');
      btn.disabled = false; btn.textContent = 'Add';
    }
  }

  function normaliseUrl(raw) {
    if (raw.startsWith('http')) return raw.replace(/\/$/, '');
    const user = raw.replace(/\.github\.io.*$/, '');
    return `https://${user}.github.io`;
  }

  
  function wireFriendReorder(grid) {
    let dragSrc = null;

    grid.querySelectorAll('.draggable-friend').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragSrc = +el.dataset.index;
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      el.addEventListener('drop', e => {
        e.preventDefault();
        const target = +el.dataset.index;
        if (dragSrc === null || dragSrc === target) return;
        const moved = friends.splice(dragSrc, 1)[0];
        friends.splice(target, 0, moved);
        saveFriends('Reorder friends').then(() => renderFriendsCircles());
      });
    });

    grid.querySelectorAll('.friend-move-up').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const i = +btn.dataset.index;
        if (i === 0) return;
        [friends[i-1], friends[i]] = [friends[i], friends[i-1]];
        saveFriends('Reorder friends').then(() => renderFriendsCircles());
      });
    });
    grid.querySelectorAll('.friend-move-dn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const i = +btn.dataset.index;
        if (i >= friends.length - 1) return;
        [friends[i], friends[i+1]] = [friends[i+1], friends[i]];
        saveFriends('Reorder friends').then(() => renderFriendsCircles());
      });
    });
  }

  async function saveFriends(msg) {
    await Autonom.commitFile('friends.json', JSON.stringify(friends, null, 2), msg);
  }

  // ─── Homepage Sections ────────────────────────────────────────────────────────
  function renderHomepageSections() {
    const hs   = config.homepageSections || {};
    const main = document.getElementById('profile-main');
    if (!main) return;
    main.querySelectorAll('.homepage-section').forEach(el => el.remove());

    const sections = [
      { key: 'gallery',   render: renderHSGallery },
      { key: 'music',     render: renderHSMusic },
      { key: 'videos',    render: renderHSVideos },
      { key: 'friends',   render: renderHSFriends },
      { key: 'guestbook', render: renderHSGuestbook },
    ];

    sections.forEach(({ key, render }) => {
      if (!hs[key]) return;
      const sec = document.createElement('section');
      sec.className = 'homepage-section';
      sec.id = `hs-${key}`;
      sec.setAttribute('aria-label', key.charAt(0).toUpperCase() + key.slice(1));
      render(sec);
      main.appendChild(sec);
    });
  }

  function renderHSGallery(sec) {
    sec.innerHTML = '<h2>Photos</h2><div class="hs-gallery-grid"></div>';
    const grid = sec.querySelector('.hs-gallery-grid');
    Autonom.ghGet(`/repos/${Autonom.OWNER}/${Autonom.REPO}/contents/assets/gallery`)
      .then(items => {
        const photos = items.filter(f => f.name.endsWith('.webp'));
        if (!photos.length) {
          if (Autonom.isOwner()) {
            grid.innerHTML = `<a href="gallery.html" class="hs-empty-cta">+ Add photos</a>`;
          } else { sec.classList.add('hidden'); }
          return;
        }
        grid.innerHTML = photos.slice(0, 9).map(p =>
          `<figure class="gallery-item"><img src="${p.download_url}" alt="${p.name}" loading="lazy" /></figure>`
        ).join('');
        if (photos.length > 9) {
          const link = document.createElement('a');
          link.href = 'gallery.html'; link.className = 'hs-link';
          link.textContent = `See all ${photos.length} photos →`;
          sec.appendChild(link);
        }
      })
      .catch(() => sec.classList.add('hidden'));
  }

  function renderHSMusic(sec) {
    const tracks = config.tracks || [];
    if (!tracks.length) {
      if (Autonom.isOwner()) {
        sec.innerHTML = '<h2>Music</h2><a href="music.html" class="hs-empty-cta">+ Add music</a>';
      } else { sec.classList.add('hidden'); }
      return;
    }
    const t = tracks[0];
    sec.innerHTML = `
      <h2>Music</h2>
      <div class="hs-player">
        <audio id="hs-audio" src="assets/music/${t.filename}"></audio>
        <p class="hs-track-title">${t.title || t.filename}</p>
        <p class="hs-track-artist">${t.artist || ''}</p>
        <button id="hs-play-pause" aria-label="Play or pause">Play</button>
        ${tracks.length > 1 ? `<a href="music.html" class="hs-link">Full playlist (${tracks.length} tracks) →</a>` : ''}
      </div>`;
    const audio   = sec.querySelector('#hs-audio');
    const playBtn = sec.querySelector('#hs-play-pause');
    playBtn?.addEventListener('click', () => {
      if (audio.paused) { audio.play(); playBtn.textContent = 'Pause'; }
      else              { audio.pause(); playBtn.textContent = 'Play'; }
    });
  }

  function renderHSVideos(sec) {
    const videos = config.videos || [];
    if (!videos.length) {
      if (Autonom.isOwner()) {
        sec.innerHTML = '<h2>Videos</h2><a href="videos.html" class="hs-empty-cta">+ Add videos</a>';
      } else { sec.classList.add('hidden'); }
      return;
    }
    sec.innerHTML = '<h2>Videos</h2>';
    const grid = document.createElement('div');
    grid.className = 'hs-videos-grid';
    grid.innerHTML = videos.slice(0, 2).map(url => {
      const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
      if (!id) return '';
      return `<div class="video-item"><div class="video-embed-wrap">
        <iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" allowfullscreen></iframe>
      </div></div>`;
    }).join('');
    sec.appendChild(grid);
    if (videos.length > 2) {
      const link = document.createElement('a');
      link.href = 'videos.html'; link.className = 'hs-link';
      link.textContent = `See all ${videos.length} videos →`;
      sec.appendChild(link);
    }
  }

  function renderHSFriends(sec) {
    fetch('friends.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        if (!list.length) { sec.classList.add('hidden'); return; }
        sec.innerHTML = '<h2>Friends</h2>';
        const grid = document.createElement('div');
        grid.className = 'hs-friends-circles';
        grid.innerHTML = list.slice(0, 6).map(f => `
          <a href="${f.url}" target="_blank" rel="noopener" class="friend-circle" aria-label="${f.displayName}">
            <img src="${f.photo}" alt="${f.displayName}" onerror="this.src='assets/profile.webp'" />
            <span>${f.displayName}</span>
          </a>`).join('');
        sec.appendChild(grid);
        if (list.length > 6) {
          const link = document.createElement('a');
          link.href = 'friends.html'; link.className = 'hs-link';
          link.textContent = `See all ${list.length} friends →`;
          sec.appendChild(link);
        }
      })
      .catch(() => sec.classList.add('hidden'));
  }

  function renderHSGuestbook(sec) {
    fetch('guestbook.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(posts => {
        const approved = (posts || []).filter(p => p.approved).slice(0, 3);
        if (!approved.length) { sec.classList.add('hidden'); return; }
        sec.innerHTML = '<h2>Guestbook</h2>';
        const list = document.createElement('div');
        list.className = 'hs-guestbook';
        list.innerHTML = approved.map(p => `
          <div class="guestbook-post">
            <div class="post-header">
              <img src="${p.avatar || 'assets/profile.webp'}" alt="${p.author}" />
              <span class="post-author">${p.author}</span>
            </div>
            <p class="post-text">${p.text}</p>
          </div>`).join('');
        sec.appendChild(list);
        const link = document.createElement('a');
        link.href = 'guestbook.html'; link.className = 'hs-link';
        link.textContent = 'View full guestbook →';
        sec.appendChild(link);
      })
      .catch(() => sec.classList.add('hidden'));
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

  // ─── Populate Edit Drawer ─────────────────────────────────────────────────────
  function populateCustomizationPanel() {
    setVal('edit-display-name', config.displayName || '');
    setVal('edit-bio',          config.bio         || '');
    setVal('edit-status',       config.status      || '');
    setVal('theme-toggle',      config.theme       || 'dark');
    setVal('bg-type',           config.background?.type  || 'color');
    setVal('bg-color',          config.background?.value || '#1a1a2e');
    setVal('custom-css',        config.customCSS   || '');

    const bgColorVal = config.background?.type === 'color' ? (config.background?.value || '#1a1a2e') : '#1a1a2e';
    const swatchEl = document.getElementById('bg-color-swatch');
    const labelEl  = document.getElementById('bg-color-label');
    if (swatchEl) swatchEl.style.background = bgColorVal;
    if (labelEl)  labelEl.textContent = bgColorVal.toUpperCase();

    const pages = config.pages || {};
    ['gallery','music','videos','friends','guestbook','games'].forEach(key => {
      const el = document.getElementById(`toggle-${key}`);
      if (el) el.checked = pages[key] !== false;
    });

    const home = config.homepageSections || {};
    ['gallery','music','videos','friends','guestbook'].forEach(key => {
      const el = document.getElementById(`home-${key}`);
      if (el) el.checked = !!home[key];
    });

    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) modeToggle.checked = config.mode === 'business';

    const bizForm = document.getElementById('business-profile-form');
    if (bizForm) {
      bizForm.classList.toggle('hidden', config.mode !== 'business');
      if (config.mode === 'business') Autonom.populateBusinessForm(config);
    }

    const dirToggle = document.getElementById('directory-toggle');
    if (dirToggle) dirToggle.checked = config.directory?.listed !== false;

    const ledgerRow = document.getElementById('ledger-domain-row');
    if (ledgerRow) ledgerRow.classList.toggle('hidden', config.directory?.listed === false);
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // ─── Save Customization ───────────────────────────────────────────────────────
  async function saveCustomization() {
    const displayName = document.getElementById('edit-display-name')?.value.trim() || '';
    const bio         = document.getElementById('edit-bio')?.value.trim()          || '';
    const status      = document.getElementById('edit-status')?.value.trim()       || '';
    const theme       = document.getElementById('theme-toggle')?.value             || 'dark';
    const bgType      = document.getElementById('bg-type')?.value                  || 'color';
    const bgColor     = document.getElementById('bg-color')?.value                 || '#1a1a2e';
    const bgImage     = document.getElementById('bg-image');
    const css         = document.getElementById('custom-css')?.value               || '';

    const pages = {};
    ['gallery','music','videos','friends','guestbook','games'].forEach(key => {
      const el = document.getElementById(`toggle-${key}`);
      if (el) pages[key] = el.checked;
    });

    const homepageSections = {};
    ['gallery','music','videos','friends','guestbook'].forEach(key => {
      const el = document.getElementById(`home-${key}`);
      if (el) homepageSections[key] = el.checked;
    });

    let bgValue = bgColor;
    if (bgType === 'image' && bgImage?.files[0]) {
      const buf = await Autonom.compressToWebP(bgImage.files[0], 500);
      await Autonom.commitFile('assets/background.webp', buf, 'Update background image', true);
      bgValue = 'assets/background.webp';
    }

    setText('display-name', displayName);
    setText('bio',    bio);
    setText('status', status);
    setText('about-bio',    bio);
    setText('about-status', status);

    await Autonom.saveConfig(config, {
      displayName, bio, status,
      theme,
      background: { type: bgType, value: bgValue },
      customCSS: css,
      pages,
      homepageSections,
    }, 'Update profile');

    AutonomTheme.applyTheme(config);
    buildTabBar();
    renderLeftColumn();
    renderHomepageSections();
    try { await Autonom.regenerateRobots(config); }    catch { /* non-fatal */ }
    try { await Autonom.regenerateSitemap(config); }   catch { /* non-fatal */ }
    try {
      if (config.mode !== 'business') await Autonom.rewriteIndexHead(config, Autonom.generatePersonJSONLD(config));
      else await Autonom.rewriteIndexHead(config, Autonom.generateJSONLD(config.businessProfile, config));
    } catch { /* non-fatal */ }
    try { await Autonom.regenerateRSS(config); } catch { /* non-fatal */ }
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
      await Autonom.saveConfig(config, {
        personalModeSnapshot: JSON.parse(JSON.stringify(config.pages)),
        pages: { gallery: true, music: false, videos: true, friends: false, guestbook: false, games: false },
        mode: 'business',
      }, 'Switch to business mode');
      Autonom.toast('Switched to Business Mode', 'success');
    }
    populateCustomizationPanel();
    renderLeftColumn();
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
            <td>CNAME</td><td>${sub}</td><td class="dns-val">${owner}.github.io</td>
          </tr></tbody>
        </table>
        <p class="dns-note">Set the CNAME value to <code>${owner}.github.io</code>.</p>`;
    }
    helper.classList.remove('hidden');
  }

  // ─── Wire Events ──────────────────────────────────────────────────────────────
  function wireEvents() {
    document.getElementById('profile-photo-wrap')?.addEventListener('click', () => {
      if (!Autonom.isOwner()) return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = e => Autonom.handleProfilePhotoUpload(e.target.files[0]);
      input.click();
    });

    document.getElementById('edit-cover')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = e => Autonom.handleCoverPhotoUpload(e.target.files[0]);
      input.click();
    });

    document.getElementById('login-btn')?.addEventListener('click', () => Autonom.enterEditMode());
    document.getElementById('edit-profile-btn')?.addEventListener('click', openEditDrawer);
    document.getElementById('edit-drawer-close')?.addEventListener('click', closeEditDrawer);
    document.getElementById('edit-drawer')?.addEventListener('click', e => {
      if (e.target === document.getElementById('edit-drawer')) closeEditDrawer();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditDrawer(); });

    function openEditDrawer() {
      populateCustomizationPanel();
      syncBgInputs();
      document.getElementById('edit-drawer')?.classList.remove('hidden');
      document.body.classList.add('drawer-open');
    }
    function closeEditDrawer() {
      document.getElementById('edit-drawer')?.classList.add('hidden');
      document.body.classList.remove('drawer-open');
    }

    document.getElementById('save-customization')?.addEventListener('click', async () => {
      await saveCustomization();
      closeEditDrawer();
    });

    // Color picker modal
    (() => {
      const modal   = document.getElementById('color-picker-modal');
      const specCvs = document.getElementById('cp-spectrum');
      const hueCvs  = document.getElementById('cp-hue');
      const preview = document.getElementById('cp-preview');
      const hexEl   = document.getElementById('cp-hex');
      const rgbEl   = document.getElementById('cp-rgb');
      const swatch  = document.getElementById('bg-color-swatch');
      const label   = document.getElementById('bg-color-label');
      const hidden  = document.getElementById('bg-color');
      if (!modal || !specCvs) return;

      const sCtx = specCvs.getContext('2d');
      const hCtx = hueCvs.getContext('2d');
      let hue = 0, draggingSpec = false, draggingHue = false;

      function drawSpectrum(h) {
        const w = specCvs.width, v = specCvs.height;
        const gH = sCtx.createLinearGradient(0,0,w,0);
        gH.addColorStop(0,'#fff'); gH.addColorStop(1,`hsl(${h},100%,50%)`);
        sCtx.fillStyle = gH; sCtx.fillRect(0,0,w,v);
        const gV = sCtx.createLinearGradient(0,0,0,v);
        gV.addColorStop(0,'rgba(0,0,0,0)'); gV.addColorStop(1,'rgba(0,0,0,1)');
        sCtx.fillStyle = gV; sCtx.fillRect(0,0,w,v);
      }
      function drawHue() {
        const w = hueCvs.width, h = hueCvs.height;
        const g = hCtx.createLinearGradient(0,0,w,0);
        for (let i = 0; i <= 360; i += 30) g.addColorStop(i/360,`hsl(${i},100%,50%)`);
        hCtx.fillStyle = g; hCtx.fillRect(0,0,w,h);
      }
      function toHex(r,g,b) {
        return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0').toUpperCase()).join('');
      }
      function applyColor(r,g,b) {
        const hex = toHex(r,g,b), rgb = `rgb(${r}, ${g}, ${b})`;
        preview.style.background = hex; hexEl.textContent = hex; rgbEl.textContent = rgb;
      }
      function sampleSpec(e) {
        const rect = specCvs.getBoundingClientRect();
        const sx = specCvs.width/rect.width, sy = specCvs.height/rect.height;
        const x = Math.max(0,Math.min(Math.round((e.clientX-rect.left)*sx),specCvs.width-1));
        const y = Math.max(0,Math.min(Math.round((e.clientY-rect.top)*sy),specCvs.height-1));
        const px = sCtx.getImageData(x,y,1,1).data;
        applyColor(px[0],px[1],px[2]);
      }
      function sampleHue(e) {
        const rect = hueCvs.getBoundingClientRect();
        const x = Math.max(0,Math.min(e.clientX-rect.left,rect.width));
        hue = Math.round((x/rect.width)*360); drawSpectrum(hue);
      }
      specCvs.addEventListener('mousedown', e => { draggingSpec=true; sampleSpec(e); });
      hueCvs.addEventListener('mousedown',  e => { draggingHue=true;  sampleHue(e); });
      specCvs.addEventListener('click', sampleSpec);
      hueCvs.addEventListener('click',  sampleHue);
      specCvs.addEventListener('touchstart', e => { draggingSpec=true; sampleSpec(e.touches[0]); }, {passive:true});
      hueCvs.addEventListener('touchstart',  e => { draggingHue=true;  sampleHue(e.touches[0]); },  {passive:true});
      specCvs.addEventListener('touchmove',  e => { if(draggingSpec) sampleSpec(e.touches[0]); }, {passive:true});
      hueCvs.addEventListener('touchmove',   e => { if(draggingHue)  sampleHue(e.touches[0]); },  {passive:true});
      document.addEventListener('mousemove', e => { if(draggingSpec) sampleSpec(e); if(draggingHue) sampleHue(e); });
      document.addEventListener('mouseup',   () => { draggingSpec=false; draggingHue=false; });
      document.addEventListener('touchend',  () => { draggingSpec=false; draggingHue=false; });

      document.getElementById('bg-color-btn')?.addEventListener('click', () => {
        drawHue(); drawSpectrum(hue);
        const cur = hidden.value || '#1a1a2e';
        applyColor(parseInt(cur.slice(1,3),16), parseInt(cur.slice(3,5),16), parseInt(cur.slice(5,7),16));
        modal.classList.remove('hidden');
      });
      document.getElementById('cp-apply')?.addEventListener('click', () => {
        const hex = hexEl.textContent;
        hidden.value = hex; swatch.style.background = hex; label.textContent = hex;
        modal.classList.add('hidden');
      });
      document.getElementById('color-picker-close')?.addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
      hexEl.addEventListener('click', () => navigator.clipboard?.writeText(hexEl.textContent).then(() => Autonom.toast(`Copied ${hexEl.textContent}`,'success')));
      rgbEl.addEventListener('click', () => navigator.clipboard?.writeText(rgbEl.textContent).then(() => Autonom.toast(`Copied ${rgbEl.textContent}`,'success')));
    })();

    const bgTypeEl    = document.getElementById('bg-type');
    const bgColorBtn  = document.getElementById('bg-color-btn');
    const bgImageWrap = document.getElementById('bg-image-wrap');
    const bgImageBtn  = document.getElementById('bg-image-btn');
    const bgImageEl   = document.getElementById('bg-image');
    const bgImageLbl  = document.getElementById('bg-image-label');
    function syncBgInputs() {
      const t = bgTypeEl?.value;
      bgColorBtn?.classList.toggle('hidden',  t !== 'color');
      bgImageWrap?.classList.toggle('hidden', t !== 'image');
    }
    bgTypeEl?.addEventListener('change', syncBgInputs);
    bgImageBtn?.addEventListener('click', () => bgImageEl?.click());
    bgImageEl?.addEventListener('change', () => {
      bgImageLbl.textContent = bgImageEl.files[0]?.name || '';
    });

    document.getElementById('mode-toggle')?.addEventListener('change', toggleMode);
    document.getElementById('save-business-profile')?.addEventListener('click', () => Autonom.saveBusinessProfile(config));
    document.getElementById('share-page')?.addEventListener('click', Autonom.handleShare);
    document.getElementById('export-backup')?.addEventListener('click', Autonom.handleExport);

    document.getElementById('directory-toggle')?.addEventListener('change', e => {
      document.getElementById('ledger-domain-row')?.classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('update-ledger-domain')?.addEventListener('click', async () => {
      const btn = document.getElementById('update-ledger-domain');
      btn.textContent = 'Detecting...'; btn.disabled = true;
      let domain = '';
      if (!location.hostname.endsWith('github.io') && location.hostname !== 'localhost') {
        domain = location.hostname;
      } else {
        try {
          const data = await Autonom.ghGet(`/repos/${Autonom.OWNER}/${Autonom.REPO}/contents/CNAME`);
          domain = atob(data.content.replace(/\n/g,'')).trim();
        } catch { /* no CNAME */ }
      }
      if (domain && !domain.endsWith('github.io')) {
        await Autonom.saveConfig(config, { customDomain: domain }, 'Update custom domain');
        await Autonom.syncDirectory(config);
        Autonom.toast(`Ledger updated — ${domain}`, 'success');
        if (config.customDomain) showDNSHelper(config.customDomain);
      } else {
        Autonom.toast('No custom domain found — your github.io address is already in the ledger', 'success');
        await Autonom.syncDirectory(config);
      }
      btn.textContent = 'Update ledger'; btn.disabled = false;
    });

    document.getElementById('verify-dns')?.addEventListener('click', async () => {
      const domain = config.customDomain;
      const result = document.getElementById('dns-verify-result');
      if (!domain || !result) return;
      result.textContent = 'Checking...'; result.className = '';
      try {
        await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
        result.textContent = '\u2713 Domain is resolving. GitHub Pages may still be building \u2014 check back in a few minutes.';
        result.className = 'dns-ok';
      } catch {
        result.textContent = '\u2717 Domain not resolving yet \u2014 DNS changes can take up to 48 hours.';
        result.className = 'dns-fail';
      }
    });

    if (config.customDomain) showDNSHelper(config.customDomain);

    document.getElementById('wizard-dismiss')?.addEventListener('click', async () => {
      document.getElementById('first-time-wizard')?.classList.add('hidden');
      await Autonom.saveConfig(config, { firstTimeSetup: false }, 'Dismiss setup wizard');
    });
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
      if (status) { updates.status = status; setText('status', status); setText('about-status', status); }
      await Autonom.saveConfig(config, updates, 'First-time setup');
      try { if (status) await Autonom.regenerateRSS(config); }  catch { /* non-fatal */ }
      try { await Autonom.regenerateSitemap(config); }           catch { /* non-fatal */ }
      document.getElementById('first-time-wizard')?.classList.add('hidden');
      buildTabBar();
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
