(() => {
  const LAMBDA_URL  = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const GITHUB_APP  = 'autonom-page';
  const GITHUB_API  = 'https://api.github.com';

  let token    = null;
  let username = null;

  // ─── Toast ────────────────────────────────────────────────────────────────────
  function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  }

  // ─── TOS gate ─────────────────────────────────────────────────────────────────
  document.getElementById('tos-agree')?.addEventListener('change', e => {
    document.getElementById('connect-github').disabled = !e.target.checked;
  });

  document.getElementById('connect-github')?.addEventListener('click', () => {
    // Store a flag so callback.html knows to redirect back to onboarding
    sessionStorage.setItem('autonom_onboarding', '1');
    location.href = `https://github.com/apps/${GITHUB_APP}/installations/new`;
  });

  // ─── Resume after GitHub App callback ─────────────────────────────────────────
  async function resumeFromCallback() {
    token    = sessionStorage.getItem('autonom_token');
    username = sessionStorage.getItem('autonom_token_owner');
    if (!token || !username) return;

    // Already authed — skip TOS step, show form
    show('step-form');
    hide('step-tos');
  }

  // ─── Deploy ───────────────────────────────────────────────────────────────────
  document.getElementById('deploy-btn')?.addEventListener('click', deploy);

  async function deploy() {
    const name  = document.getElementById('input-name')?.value.trim();
    const bio   = document.getElementById('input-bio')?.value.trim();
    const photo = document.getElementById('input-photo')?.files[0];

    if (!name) { toast('Display name is required', 'error'); return; }

    const btn = document.getElementById('deploy-btn');
    if (btn) btn.disabled = true;

    hide('step-form');
    show('step-progress');

    try {
      // 1 — Create repo
      await step('prog-repo', createRepo());

      // 2 — Push template files (compress photo first if provided)
      let photoData = null;
      if (photo) photoData = await compressToWebP(photo, 200);
      await step('prog-files', pushTemplate(name, bio, photoData));

      // 3 — Enable Pages
      await step('prog-pages', enablePages());

      // 4 — Poll until live
      await step('prog-build', pollUntilLive());

      // 5 — Done
      markDone('prog-live');

      setTimeout(() => {
        // Clear onboarding session flag, keep token for edit mode
        sessionStorage.removeItem('autonom_onboarding');
        location.href = `https://${username}.github.io`;
      }, 1500);

    } catch (e) {
      toast(`Deploy failed — ${e.message}`, 'error');
      if (btn) btn.disabled = false;
      hide('step-progress');
      show('step-form');
    }
  }

  // ─── GitHub API helpers ───────────────────────────────────────────────────────
  async function ghPost(path, body) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `POST ${path} failed: ${res.status}`);
    }
    return res.json();
  }

  async function ghPut(path, body) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
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

  // ─── Repo creation ────────────────────────────────────────────────────────────
  async function createRepo() {
    await ghPost('/user/repos', {
      name: `${username}.github.io`,
      description: `${username}'s personal Autonom page`,
      private: false,
      auto_init: false,
    });
  }

  // ─── Template push ────────────────────────────────────────────────────────────
  async function pushTemplate(displayName, bio, photoBuffer) {
    const repo  = `${username}/${username}.github.io`;
    const siteUrl = `https://${username}.github.io`;

    // Fetch all template files from this repo's template/ directory via raw URLs
    const templateBase = 'https://raw.githubusercontent.com/Shannon-Goddard/autonom-page/main/template';

    // Files to fetch and push as-is (text)
    const textFiles = [
      'auth.js', 'nav.js', 'theme.js', 'styles.css', 'sw.js',
      'github-api.js', 'media.js', 'feeds.js', 'business.js', 'admin.js',
      'index.js', 'index.html', 'callback.html',
      'gallery.html', 'gallery.js',
      'music.html', 'music.js',
      'videos.html', 'videos.js',
      'friends.html', 'friends.js',
      'guestbook.html', 'guestbook.js',
      'games.html', 'games.js',
      '404.html', 'manifest.json',
      'robots.txt', 'rss.xml', 'sitemap.xml',
      'friends.json', 'guestbook.json',
      'games/tetris.js', 'games/snake.js', 'games/breakout.js',
      'games/pacman.js', 'games/spaceinvaders.js',
    ];

    // Binary assets
    const binaryFiles = [
      'assets/icon-192.png',
      'assets/icon-512.png',
      'assets/icon-32.png',
      'assets/favicon.ico',
    ];

    // Build site-config.json with user's details
    const config = buildConfig(displayName, bio, siteUrl);

    // Commit site-config.json first (needed by other files)
    await commitFile(repo, 'site-config.json',
      btoa(unescape(encodeURIComponent(JSON.stringify(config, null, 2)))),
      'Initial site-config.json');

    // Push text files
    for (const file of textFiles) {
      let content = await fetchTemplate(`${templateBase}/${file}`);
      // Patch index.html OG tags with real values
      if (file === 'index.html') content = patchIndexHtml(content, displayName, bio, username);
      // Patch manifest.json with display name
      if (file === 'manifest.json') content = patchManifest(content, displayName);
      const encoded = btoa(unescape(encodeURIComponent(content)));
      await commitFile(repo, file, encoded, `Add ${file}`);
    }

    // Push binary assets
    for (const file of binaryFiles) {
      const buf     = await fetchTemplateBinary(`${templateBase}/${file}`);
      const encoded = arrayBufferToBase64(buf);
      await commitFile(repo, file, encoded, `Add ${file}`);
    }

    // Push profile photo if provided
    if (photoBuffer) {
      const encoded = arrayBufferToBase64(photoBuffer);
      await commitFile(repo, 'assets/profile.webp', encoded, 'Add profile photo');
      await commitFile(repo, 'assets/cover.webp',   encoded, 'Add cover photo');
    }
  }

  async function commitFile(repo, path, base64Content, message) {
    // Check if file exists (get SHA)
    let sha;
    try {
      const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
      });
      if (res.ok) { const d = await res.json(); sha = d.sha; }
    } catch { /* new file */ }

    await ghPut(`/repos/${repo}/contents/${path}`, {
      message,
      content: base64Content,
      ...(sha ? { sha } : {}),
    });
  }

  // ─── Enable GitHub Pages ──────────────────────────────────────────────────────
  async function enablePages() {
    const repo = `${username}/${username}.github.io`;
    try {
      await ghPost(`/repos/${repo}/pages`, {
        source: { branch: 'main', path: '/' },
      });
    } catch (e) {
      // 409 = Pages already enabled — not an error
      if (!e.message.includes('409') && !e.message.toLowerCase().includes('already')) throw e;
    }
  }

  // ─── Poll until live ──────────────────────────────────────────────────────────
  async function pollUntilLive() {
    const url     = `https://${username}.github.io`;
    const timeout = Date.now() + 3 * 60 * 1000; // 3 min max

    while (Date.now() < timeout) {
      await sleep(5000);
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) return;
      } catch { /* not live yet */ }
    }
    throw new Error('Site did not come online within 3 minutes — check GitHub Pages settings');
  }

  // ─── Template patching ────────────────────────────────────────────────────────
  function patchIndexHtml(html, displayName, bio, user) {
    const siteUrl = `https://${user}.github.io`;
    return html
      .replace(/content="My Page"/g,          `content="${escHtml(displayName)}'s Page"`)
      .replace(/content="assets\/profile\.webp"/g, `content="${siteUrl}/assets/profile.webp"`)
      .replace(/content=""/g,                  `content="${escHtml(bio)}"`)
      .replace(/content=""/,                   `content="${siteUrl}"`);
  }

  function patchManifest(json, displayName) {
    try {
      const m = JSON.parse(json);
      m.name       = `${displayName}'s Page`;
      m.short_name = displayName.split(' ')[0];
      return JSON.stringify(m, null, 2);
    } catch { return json; }
  }

  function buildConfig(displayName, bio, siteUrl) {
    return {
      displayName,
      bio,
      status: '',
      theme: 'dark',
      background: { type: 'color', value: '#1a1a2e' },
      pages: { gallery: true, music: true, videos: true, friends: true, guestbook: true, games: true },
      directory: { listed: true },
      customDomain: '',
      currentTrack: { filename: '', title: '', artist: '' },
      videos: [],
      rss: { enabled: true },
      lastUpdated: new Date().toISOString(),
      firstTimeSetup: true,
      mode: 'personal',
      personalModeSnapshot: null,
      configVersion: 1,
      businessProfile: {
        enabled: false, type: '', name: '', category: '',
        address: { locality: '', region: '', country: '' },
        phone: '', email: '', priceRange: '', services: [], hours: [],
      },
    };
  }

  // ─── Fetch helpers ────────────────────────────────────────────────────────────
  async function fetchTemplate(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch template file: ${url}`);
    return res.text();
  }

  async function fetchTemplateBinary(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch binary: ${url}`);
    return res.arrayBuffer();
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  // ─── Image compression (same as media.js but standalone here) ─────────────────
  function compressToWebP(file, maxKb) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        let quality = 0.85;
        const tryEncode = () => {
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => {
            if (!blob) { resolve(new ArrayBuffer(0)); return; }
            if (blob.size > maxKb * 1024 && quality > 0.3) {
              quality -= 0.1;
              tryEncode();
            } else {
              blob.arrayBuffer().then(resolve);
            }
          }, 'image/webp', quality);
        };
        tryEncode();
      };
      img.src = url;
    });
  }

  // ─── Progress UI helpers ──────────────────────────────────────────────────────
  function step(id, promise) {
    markPending(id);
    return promise.then(() => markDone(id)).catch(e => { markFail(id); throw e; });
  }

  function markPending(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('pending'); el.classList.remove('done', 'fail'); }
  }
  function markDone(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('done'); el.classList.remove('pending', 'fail'); }
  }
  function markFail(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('fail'); el.classList.remove('pending', 'done'); }
  }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  resumeFromCallback();
})();
