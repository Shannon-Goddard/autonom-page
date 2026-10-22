(() => {
  // ─── Constants ───────────────────────────────────────────────────────────────
  const LAMBDA_URL = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const GITHUB_APP  = 'autonom-page';
  const REPO_OWNER  = document.location.hostname.split('.')[0]; // username from username.github.io

  // ─── Toast System ────────────────────────────────────────────────────────────
  function toast(message, type = 'success', retryFn = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.textContent = message;

    if (retryFn) {
      const btn = document.createElement('button');
      btn.textContent = 'Retry';
      btn.setAttribute('aria-label', 'Retry action');
      btn.onclick = () => { t.remove(); retryFn(); };
      t.appendChild(btn);
    }

    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ─── Session Storage Helpers ─────────────────────────────────────────────────
  function getToken()          { return sessionStorage.getItem('autonom_token'); }
  function getTokenOwner()     { return sessionStorage.getItem('autonom_token_owner'); }
  function setSession(token, owner) {
    sessionStorage.setItem('autonom_token', token);
    sessionStorage.setItem('autonom_token_owner', owner);
  }
  function clearSession() {
    sessionStorage.removeItem('autonom_token');
    sessionStorage.removeItem('autonom_token_owner');
  }

  // ─── Edit Mode ───────────────────────────────────────────────────────────────
  function isOwner() {
    return getTokenOwner() === REPO_OWNER;
  }

  function unlockEditMode() {
    document.querySelectorAll('.edit-btn').forEach(btn => btn.classList.remove('hidden'));
    const panel = document.getElementById('customization-panel');
    if (panel) panel.classList.remove('hidden');
    document.body.classList.add('edit-mode');
  }

  function lockEditMode() {
    document.querySelectorAll('.edit-btn').forEach(btn => btn.classList.add('hidden'));
    const panel = document.getElementById('customization-panel');
    if (panel) panel.classList.add('hidden');
    document.body.classList.remove('edit-mode');
  }

  // ─── Business Mode DOM Strip ─────────────────────────────────────────────────
  // Runs before render — removes all visitor input elements when mode is business
  function applyBusinessMode() {
    const visitorInputSelectors = [
      '#post-btn',
      '#post-form',
      '#visitor-modal',
      '#post-cta',
    ];
    visitorInputSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.remove();
    });
    document.body.classList.add('business-mode');
  }

  // ─── Load site-config and apply mode ─────────────────────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch('site-config.json', { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ─── GitHub App Installation Flow ────────────────────────────────────────────
  // Called when owner wants to enter edit mode and has no active session
  function redirectToGitHubApp() {
    const callbackUrl = encodeURIComponent(`${location.origin}/callback.html`);
    location.href = `https://github.com/apps/${GITHUB_APP}/installations/new`;
  }

  // Called on callback.html after GitHub redirects back with installation_id
  async function exchangeInstallationToken(installationId) {
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation_id: installationId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(`Login failed — ${err.error || res.status}`, 'error');
        return null;
      }

      const { token, expires_at } = await res.json();
      return { token, expires_at };
    } catch {
      toast('Login failed — network error', 'error');
      return null;
    }
  }

  // Verify token is still valid and fetch the authenticated GitHub username
  async function fetchAuthenticatedUser(token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.login;
    } catch {
      return null;
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────
  function logout() {
    clearSession();
    lockEditMode();
    toast('Logged out', 'success');
  }

  // ─── Edit Mode Entry Point ────────────────────────────────────────────────────
  async function enterEditMode() {
    const token = getToken();
    if (token && getTokenOwner() === REPO_OWNER) {
      unlockEditMode();
      return;
    }
    clearSession();
    redirectToGitHubApp();
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  async function init() {
    const config = await loadConfig();

    if (config?.mode === 'business') applyBusinessMode();

    const token = getToken();
    if (token && getTokenOwner() === REPO_OWNER) {
      unlockEditMode();
      if (config?.firstTimeSetup) {
        const wizard = document.getElementById('first-time-wizard');
        if (wizard) wizard.classList.remove('hidden');
      }
    }

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', enterEditMode);
    });
  }

  // ─── Service Worker Registration ─────────────────────────────────────────────
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/sw.js');

      // Check configVersion — invalidate shell cache if it changed
      const storedVersion = localStorage.getItem('autonom_config_version');
      const config = await loadConfig();
      if (config?.configVersion !== undefined) {
        const current = String(config.configVersion);
        if (storedVersion && storedVersion !== current) {
          const reg = await navigator.serviceWorker.ready;
          reg.active?.postMessage({ type: 'INVALIDATE_SHELL' });
        }
        localStorage.setItem('autonom_config_version', current);
      }
    } catch {
      // SW registration failure is non-fatal
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  window.Autonom = {
    toast,
    getToken,
    isOwner,
    logout,
    enterEditMode,
    exchangeInstallationToken,
    setSession,
    clearSession,
    REPO_OWNER,
    LAMBDA_URL,
  };

  init();
  registerSW();
})();
