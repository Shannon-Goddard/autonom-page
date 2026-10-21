(() => {
  let siteConfig  = {};
  let approved    = [];
  const REPO      = `${Autonom.OWNER}/${Autonom.OWNER}.github.io`;
  const LABEL     = 'pending-post';

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    // Load site config for display name
    try {
      const r = await fetch('site-config.json', { cache: 'no-store' });
      if (r.ok) siteConfig = await r.json();
    } catch { /* offline */ }

    // Load approved posts
    try {
      const r = await fetch('guestbook.json', { cache: 'no-store' });
      if (r.ok) approved = await r.json();
    } catch { /* offline */ }

    renderApproved();
    wirePostCTA();

    if (Autonom.isOwner()) {
      document.getElementById('moderation-inbox')?.classList.remove('hidden');
      loadPendingPosts();
    }
  }

  // ─── Render approved posts ────────────────────────────────────────────────────
  function renderApproved() {
    const el = document.getElementById('approved-posts');
    if (!el) return;
    if (!approved.length) {
      el.innerHTML = '<p class="guestbook-empty">No posts yet. Be the first!</p>';
      return;
    }
    el.innerHTML = approved.map(p => `
      <article class="guestbook-post">
        <header class="post-header">
          <img src="${p.photo || ''}" alt="${p.displayName}"
            onerror="this.src='assets/profile.webp'" loading="lazy" />
          <div>
            <a href="${p.siteUrl}" target="_blank" rel="noopener"
              class="post-author" aria-label="Visit ${p.displayName}'s page">${p.displayName}</a>
            <time class="post-time">${formatDate(p.createdAt)}</time>
          </div>
        </header>
        <p class="post-text">${escHtml(p.text)}</p>
        ${p.image ? `<img src="${p.image}" alt="Post image" class="post-image" loading="lazy" />` : ''}
        ${p.video ? `<a href="${p.video}" target="_blank" rel="noopener" class="post-video-link"
          aria-label="Watch video">▶ Watch video</a>` : ''}
      </article>`).join('');
  }

  // ─── Post CTA — visitor flow ──────────────────────────────────────────────────
  function wirePostCTA() {
    const name = siteConfig.displayName || Autonom.OWNER;

    // Update modal headline with owner name
    const h2 = document.querySelector('#visitor-modal h2');
    if (h2) h2.textContent = `Want to post on ${name}'s page?`;

    document.getElementById('post-btn')?.addEventListener('click', () => {
      if (Autonom.isOwner()) return; // owner doesn't post to own guestbook

      if (Autonom.getToken()) {
        // Authenticated — check platform membership then show form
        openPostForm();
      } else {
        // Not authenticated — show welcoming modal
        openModal('visitor-modal');
      }
    });

    document.getElementById('modal-login')?.addEventListener('click', () => {
      closeModal('visitor-modal');
      Autonom.login(); // triggers GitHub App OAuth flow
    });

    document.getElementById('modal-signup')?.addEventListener('click', () => {
      window.location.href = 'https://autonom.page';
    });

    document.getElementById('modal-close')?.addEventListener('click', () =>
      closeModal('visitor-modal')
    );

    document.getElementById('cancel-post')?.addEventListener('click', () =>
      closePostForm()
    );

    document.getElementById('submit-post')?.addEventListener('click', submitPost);
  }

  // ─── Post form ────────────────────────────────────────────────────────────────
  async function openPostForm() {
    // Verify poster has their own Autonom page (platform membership check)
    const posterUsername = Autonom.getUsername();
    if (!posterUsername) { Autonom.toast('Could not verify your identity', 'error'); return; }

    try {
      const r = await fetch(`https://${posterUsername}.github.io/site-config.json`);
      if (!r.ok) throw new Error();
    } catch {
      openModal('visitor-modal'); // not a platform member — show signup modal
      return;
    }

    document.getElementById('post-cta')?.classList.add('hidden');
    document.getElementById('post-form')?.classList.remove('hidden');
    document.getElementById('post-text')?.focus();
  }

  function closePostForm() {
    document.getElementById('post-form')?.classList.add('hidden');
    document.getElementById('post-cta')?.classList.remove('hidden');
    const txt = document.getElementById('post-text');
    const img = document.getElementById('post-image');
    const vid = document.getElementById('post-video');
    if (txt) txt.value = '';
    if (img) img.value = '';
    if (vid) vid.value = '';
  }

  async function submitPost() {
    const text  = document.getElementById('post-text')?.value.trim();
    const image = document.getElementById('post-image')?.files[0];
    const video = document.getElementById('post-video')?.value.trim();

    if (!text) { Autonom.toast('Post text is required', 'error'); return; }

    const btn = document.getElementById('submit-post');
    if (btn) btn.disabled = true;

    const posterUsername = Autonom.getUsername();
    let imagePath = '';

    // Commit image to pending folder in owner's repo using poster's token
    if (image) {
      try {
        const buf  = await Autonom.compressToWebP(image, 200);
        const name = `${Date.now()}-${posterUsername}.webp`;
        imagePath  = `assets/posts/pending/${name}`;
        await Autonom.commitFile(imagePath, buf, `Pending post image from ${posterUsername}`, true);
      } catch {
        Autonom.toast('Image upload failed — submitting without image', 'error');
        imagePath = '';
      }
    }

    // Open Issue on owner's repo with structured payload
    const payload = { poster: posterUsername, text, image: imagePath, video, createdAt: new Date().toISOString() };
    const body    = `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

    try {
      await Autonom.ghPost(`/repos/${REPO}/issues`, {
        title: `Pending post from ${posterUsername}`,
        body,
        labels: [LABEL],
      });
      closePostForm();
      Autonom.toast('Post submitted — waiting for approval', 'success');
    } catch {
      Autonom.toast('Submission failed — please try again', 'error');
    }

    if (btn) btn.disabled = false;
  }

  // ─── Owner moderation ─────────────────────────────────────────────────────────
  async function loadPendingPosts() {
    const list = document.getElementById('pending-posts-list');
    if (!list) return;
    list.innerHTML = '<p class="guestbook-loading">Loading pending posts\u2026</p>';

    let issues = [];
    try {
      issues = await Autonom.ghGet(`/repos/${REPO}/issues?labels=${LABEL}&state=open`);
    } catch {
      list.innerHTML = '<p class="guestbook-empty">Could not load pending posts.</p>';
      return;
    }

    if (!issues.length) {
      list.innerHTML = '<p class="guestbook-empty">No pending posts.</p>';
      return;
    }

    list.innerHTML = issues.map(issue => {
      const payload = parseIssuePayload(issue.body);
      if (!payload) return '';
      return `
        <div class="pending-post" data-issue="${issue.number}" data-payload='${JSON.stringify(payload)}'>
          <div class="pending-post-meta">
            <img src="https://${payload.poster}.github.io/assets/profile.webp" alt="${payload.poster}"
              onerror="this.src='assets/profile.webp'" loading="lazy" />
            <a href="https://${payload.poster}.github.io" target="_blank" rel="noopener"
              aria-label="Visit ${payload.poster}'s page">@${payload.poster}</a>
            <time>${formatDate(payload.createdAt)}</time>
          </div>
          <p class="pending-post-text">${escHtml(payload.text)}</p>
          ${payload.image ? `<img src="${payload.image}" alt="Post image" class="post-image" loading="lazy" />` : ''}
          ${payload.video ? `<a href="${payload.video}" target="_blank" rel="noopener">▶ Video</a>` : ''}
          <div class="moderation-actions">
            <button class="approve-btn" data-issue="${issue.number}" aria-label="Approve post">Approve</button>
            <button class="reject-btn edit-btn" data-issue="${issue.number}" aria-label="Reject post">Reject</button>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.approve-btn').forEach(btn =>
      btn.addEventListener('click', () => approvePost(btn.dataset.issue))
    );
    list.querySelectorAll('.reject-btn').forEach(btn =>
      btn.addEventListener('click', () => rejectPost(btn.dataset.issue))
    );
  }

  async function approvePost(issueNumber) {
    const card    = document.querySelector(`.pending-post[data-issue="${issueNumber}"]`);
    const payload = JSON.parse(card?.dataset.payload || '{}');
    if (!payload.poster) return;

    // Build approved post entry
    const post = {
      displayName: payload.poster,
      siteUrl:     `https://${payload.poster}.github.io`,
      photo:       `https://${payload.poster}.github.io/assets/profile.webp`,
      text:        payload.text,
      image:       payload.image
        ? payload.image.replace('assets/posts/pending/', 'assets/posts/')
        : '',
      video:       payload.video || '',
      createdAt:   payload.createdAt,
    };

    // Move image from pending → approved path if present
    if (payload.image) {
      try {
        const sha = await Autonom.getFileSHA(payload.image);
        const buf = await (await Autonom.ghGet(
          `/repos/${REPO}/contents/${payload.image}`
        )).content; // base64 — commitFile handles encoding
        await Autonom.commitFile(post.image, atob(buf.replace(/\n/g, '')), 'Approve post image', true);
        await Autonom.ghDelete(`/repos/${REPO}/contents/${payload.image}`, {
          message: 'Remove pending post image after approval', sha,
        });
      } catch { /* image move failed — approve text anyway */ }
    }

    // Append to guestbook.json and commit
    approved.push(post);
    await Autonom.commitFile('guestbook.json', JSON.stringify(approved, null, 2), `Approve post from ${payload.poster}`);

    // Close issue
    await Autonom.ghPatch(`/repos/${REPO}/issues/${issueNumber}`, { state: 'closed' });

    card?.remove();
    renderApproved();
    Autonom.toast('Post approved', 'success');
  }

  async function rejectPost(issueNumber) {
    const card    = document.querySelector(`.pending-post[data-issue="${issueNumber}"]`);
    const payload = JSON.parse(card?.dataset.payload || '{}');

    // Delete pending image if present
    if (payload.image) {
      try {
        const sha = await Autonom.getFileSHA(payload.image);
        await Autonom.ghDelete(`/repos/${REPO}/contents/${payload.image}`, {
          message: 'Delete rejected post image', sha,
        });
      } catch { /* already gone */ }
    }

    // Close and label issue as rejected
    await Autonom.ghPatch(`/repos/${REPO}/issues/${issueNumber}`, {
      state: 'closed', labels: [LABEL, 'rejected'],
    });

    card?.remove();
    Autonom.toast('Post rejected', 'success');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function parseIssuePayload(body) {
    try {
      const match = body.match(/```json\n([\s\S]+?)\n```/);
      return match ? JSON.parse(match[1]) : null;
    } catch { return null; }
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

  init();
})();
