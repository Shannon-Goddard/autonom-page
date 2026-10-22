(() => {
  const LAMBDA_URL  = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const GITHUB_APP  = 'autonom-page';
  const CLIENT_ID   = 'Iv23liDBARfsjA2e1odh';
  const GITHUB_API  = 'https://api.github.com';

  let userToken    = null; // OAuth user token — repo creation only
  let installToken = null; // Installation token — all content writes
  let username     = null;

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
    sessionStorage.setItem('autonom_onboarding', '1');
    // Step 1: OAuth flow to get user token (needed for repo creation)
    location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo&redirect_uri=https://autonom.page/callback`;
  });

  // ─── Resume after callback ────────────────────────────────────────────────────
  async function resumeFromCallback() {
    userToken    = sessionStorage.getItem('autonom_user_token');
    installToken = sessionStorage.getItem('autonom_token');
    username     = sessionStorage.getItem('autonom_token_owner');

    if (!username) return;

    // Have user token but no install token yet — need App installation
    if (userToken && !installToken) {
      show('step-install');
      hide('step-tos');
      document.getElementById('install-link')?.setAttribute(
        'href', `https://github.com/apps/${GITHUB_APP}/installations/new`
      );
      return;
    }

    // Have both — ready to deploy
    if (userToken && installToken) {
      show('step-form');
      hide('step-tos');
    }
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
      // Use userToken for repo creation
      await step('prog-repo', createRepo());

      // Use installToken for all file writes
      let photoData = null;
      if (photo) photoData = await compressToWebP(photo, 200);
      await step('prog-files', pushTemplate(name, bio, photoData));

      await step('prog-pages', enablePages());
      await step('prog-build', pollUntilLive());

      markDone('prog-live');

      setTimeout(() => {
        sessionStorage.removeItem('autonom_onboarding');
        sessionStorage.removeItem('autonom_user_token');
        const t = encodeURIComponent(installToken || userToken || '');
        const u = encodeURIComponent(username);
        location.href = `https://${username}.github.io#autonom_token=${t}|${u}`;
      }, 1500);

    } catch (e) {
      toast(`Deploy failed — ${e.message}`, 'error');
      if (btn) btn.disabled = false;
      hide('step-progress');
      show('step-form');
    }
  }

  // ─── GitHub API helpers ───────────────────────────────────────────────────────
  async function ghPost(path, body, token) {
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
        Authorization: `token ${userToken}`,
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

  // ─── Repo creation (uses userToken) ──────────────────────────────────────────
  async function createRepo() {
    const check = await fetch(`${GITHUB_API}/repos/${username}/${username}.github.io`, {
      headers: { Authorization: `token ${userToken}`, Accept: 'application/vnd.github+json' },
    });
    if (check.ok) throw new Error(`You already have a ${username}.github.io repo. Visit it at https://${username}.github.io`);
    await ghPost('/user/repos', {
      name: `${username}.github.io`,
      description: `${username}'s personal Autonom page`,
      private: false,
      auto_init: true,
    }, userToken);
  }

  // ─── Template push — single commit via Git tree API ────────────────────────
  async function pushTemplate(displayName, bio, photoBuffer) {
    const repo        = `${username}/${username}.github.io`;
    const siteUrl     = `https://${username}.github.io`;
    const templateBase = 'https://raw.githubusercontent.com/Shannon-Goddard/autonom-page/main/template';

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

    const binaryFiles = [
      'assets/icon-192.png',
      'assets/icon-512.png',
      'assets/icon-32.png',
      'assets/favicon.ico',
    ];

    // Fetch all files in parallel
    const [textContents, binaryContents] = await Promise.all([
      Promise.all(textFiles.map(f => fetchTemplate(`${templateBase}/${f}`))),
      Promise.all(binaryFiles.map(f => fetchTemplateBinary(`${templateBase}/${f}`))),
    ]);

    // Build tree entries
    const treeItems = [];

    // Text files
    textFiles.forEach((file, i) => {
      let content = textContents[i];
      if (file === 'index.html') content = patchIndexHtml(content, displayName, bio, username);
      if (file === 'manifest.json') content = patchManifest(content, displayName);
      treeItems.push({ path: file, mode: '100644', type: 'blob', content });
    });

    // site-config.json
    const config = buildConfig(displayName, bio, siteUrl);
    treeItems.push({
      path: 'site-config.json', mode: '100644', type: 'blob',
      content: JSON.stringify(config, null, 2),
    });

    // Binary files — must create blobs first (tree API requires sha for binary)
    for (let i = 0; i < binaryFiles.length; i++) {
      const sha = await createBlob(repo, arrayBufferToBase64(binaryContents[i]));
      treeItems.push({ path: binaryFiles[i], mode: '100644', type: 'blob', sha });
    }

    // Profile photo
    if (photoBuffer) {
      const sha = await createBlob(repo, arrayBufferToBase64(photoBuffer));
      treeItems.push({ path: 'assets/profile.webp', mode: '100644', type: 'blob', sha });
      treeItems.push({ path: 'assets/cover.webp',   mode: '100644', type: 'blob', sha });
    }

    // Create tree
    const treeRes = await ghPost(`/repos/${repo}/git/trees`, { tree: treeItems }, userToken);

    // Get default branch ref to find parent commit
    const refRes  = await ghGet(`/repos/${repo}/git/ref/heads/main`);
    const parentSha = refRes?.object?.sha;

    // Create commit
    const commitBody = { message: 'Initial Autonom deploy', tree: treeRes.sha };
    if (parentSha) commitBody.parents = [parentSha];
    const commitRes = await ghPost(`/repos/${repo}/git/commits`, commitBody, userToken);

    // Update ref
    await ghPatch(`/repos/${repo}/git/refs/heads/main`, { sha: commitRes.sha }, userToken);
  }

  async function createBlob(repo, base64Content) {
    const res = await ghPost(`/repos/${repo}/git/blobs`,
      { content: base64Content, encoding: 'base64' }, userToken);
    return res.sha;
  }

  async function ghGet(path) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: { Authorization: `token ${userToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function ghPatch(path, body, token) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `PATCH ${path} failed: ${res.status}`);
    }
    return res.json();
  }

  // ─── Enable GitHub Pages (uses installToken) ──────────────────────────────────
  async function enablePages() {
    const repo = `${username}/${username}.github.io`;
    try {
      await ghPost(`/repos/${repo}/pages`, { source: { branch: 'main', path: '/' } }, userToken);
    } catch (e) {
      if (!e.message.includes('409') && !e.message.toLowerCase().includes('already')) throw e;
    }
  }

  // ─── Poll until live ──────────────────────────────────────────────────────────
  async function pollUntilLive() {
    const url     = `https://${username}.github.io`;
    const timeout = Date.now() + 3 * 60 * 1000;
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
      .replace(/content="My Page"/g,               `content="${escHtml(displayName)}'s Page"`)
      .replace(/content="assets\/profile\.webp"/g,  `content="${siteUrl}/assets/profile.webp"`)
      .replace(/content=""/g,                        `content="${escHtml(bio)}"`)
      .replace(/content=""/,                         `content="${siteUrl}"`);
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
      displayName, bio, status: '', theme: 'dark',
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
    if (!res.ok) throw new Error(`Could not fetch template: ${url}`);
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
            if (blob.size > maxKb * 1024 && quality > 0.3) { quality -= 0.1; tryEncode(); }
            else blob.arrayBuffer().then(resolve);
          }, 'image/webp', quality);
        };
        tryEncode();
      };
      img.src = url;
    });
  }

  // ─── Progress UI ──────────────────────────────────────────────────────────────
  function step(id, promise) {
    markPending(id);
    return promise.then(() => markDone(id)).catch(e => { markFail(id); throw e; });
  }
  function markPending(id) { const el = document.getElementById(id); if (el) { el.classList.add('pending'); el.classList.remove('done','fail'); } }
  function markDone(id)    { const el = document.getElementById(id); if (el) { el.classList.add('done');    el.classList.remove('pending','fail'); } }
  function markFail(id)    { const el = document.getElementById(id); if (el) { el.classList.add('fail');    el.classList.remove('pending','done'); } }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  resumeFromCallback();
})();
