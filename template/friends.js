(() => {
  let friends = []; // [{ url, displayName, photo }]

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('friends.json', { cache: 'no-store' });
      if (res.ok) friends = await res.json();
    } catch { /* offline — render whatever was cached */ }

    renderFriends();

    if (Autonom.isOwner()) {
      document.getElementById('add-friend-controls')?.classList.remove('hidden');
      document.getElementById('add-friend-btn')?.addEventListener('click', () => {
        const input = document.getElementById('friend-url-input');
        const url   = normalisedUrl(input?.value.trim());
        if (url) { addFriend(url); input.value = ''; }
      });
      document.getElementById('friend-url-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('add-friend-btn')?.click();
      });
    }
  }

  // ─── Normalise input → https://username.github.io ────────────────────────────
  function normalisedUrl(raw) {
    if (!raw) return '';
    // Accept bare "username", "username.github.io", or full URL
    if (!raw.includes('.')) raw = `${raw}.github.io`;
    if (!raw.startsWith('http')) raw = `https://${raw}`;
    try { return new URL(raw).origin; } catch { return ''; }
  }

  // ─── Fetch a friend's public profile via raw static URL (no API, no rate limit)
  async function fetchFriendProfile(siteUrl) {
    try {
      const res = await fetch(`${siteUrl}/site-config.json`, { cache: 'no-store' });
      if (!res.ok) return null;
      const cfg = await res.json();
      return {
        url:         siteUrl,
        displayName: cfg.displayName || siteUrl,
        photo:       `${siteUrl}/assets/profile.webp`,
      };
    } catch {
      return null;
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function renderFriends() {
    const grid = document.getElementById('friends-grid');
    if (!grid) return;

    if (!friends.length) {
      grid.innerHTML = '<p class="friends-empty">No friends added yet.</p>';
      return;
    }

    grid.innerHTML = friends.map(f => `
      <div class="friend-card">
        <a href="${f.url}" target="_blank" rel="noopener" aria-label="Visit ${f.displayName}'s page">
          <img src="${f.photo}" alt="${f.displayName}" loading="lazy"
            onerror="this.src='assets/profile.webp'" />
          <p class="friend-name">${f.displayName}</p>
        </a>
        ${Autonom.isOwner()
          ? `<button class="remove-friend edit-btn" data-url="${f.url}"
              aria-label="Remove ${f.displayName}">Remove</button>`
          : ''}
      </div>`).join('');

    grid.querySelectorAll('.remove-friend').forEach(btn =>
      btn.addEventListener('click', () => removeFriend(btn.dataset.url))
    );
  }

  // ─── Add ──────────────────────────────────────────────────────────────────────
  async function addFriend(url) {
    if (friends.some(f => f.url === url)) {
      Autonom.toast('Already in your friends list', 'error'); return;
    }

    Autonom.toast('Looking up profile…', 'success');
    const profile = await fetchFriendProfile(url);

    if (!profile) {
      Autonom.toast('Could not find an Autonom page at that URL', 'error'); return;
    }

    friends.push(profile);
    await saveFriends('Add friend');
    renderFriends();
    Autonom.toast(`${profile.displayName} added`, 'success');
  }

  // ─── Remove ───────────────────────────────────────────────────────────────────
  async function removeFriend(url) {
    const f = friends.find(f => f.url === url);
    friends = friends.filter(f => f.url !== url);
    await saveFriends('Remove friend');
    renderFriends();
    Autonom.toast(`${f?.displayName || 'Friend'} removed`, 'success');
  }

  // ─── Persist friends.json ─────────────────────────────────────────────────────
  async function saveFriends(msg) {
    const content = JSON.stringify(friends, null, 2);
    await Autonom.commitFile('friends.json', content, msg);
  }

  init();
})();
