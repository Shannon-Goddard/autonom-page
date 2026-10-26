(() => {
  // ─── Constants ───────────────────────────────────────────────────────────────
  const LAMBDA_URL = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const GITHUB_APP  = 'autonom-page';
  const REPO_OWNER = (() => {
    const h = document.location.hostname;
    // localhost / file:// — read from a data attribute set by the repo or fall back to empty
    if (h === 'localhost' || h === '127.0.0.1' || h === '') {
      return document.documentElement.dataset.owner || '';
    }
    return h.split('.')[0];
  })();

  // ─── Read hash token immediately — before anything else runs ─────────────────
  if (location.hash.includes('autonom_token=')) {
    const raw = location.hash.slice(1).replace('autonom_token=', '');
    const [t, o] = raw.split('|').map(decodeURIComponent);
    if (t && o) {
      sessionStorage.setItem('autonom_token', t);
      sessionStorage.setItem('autonom_token_owner', o);
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

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
    document.body.classList.add('edit-mode');
    document.getElementById('edit-profile-btn')?.classList.remove('hidden');
    document.getElementById('edit-cover')?.classList.remove('hidden');
    document.getElementById('profile-photo-wrap')?.classList.add('owner');
  }

  function lockEditMode() {
    document.body.classList.remove('edit-mode');
    document.getElementById('edit-profile-btn')?.classList.add('hidden');
    document.getElementById('edit-cover')?.classList.add('hidden');
    document.getElementById('profile-photo-wrap')?.classList.remove('owner');
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

  // ─── Device Flow Login ────────────────────────────────────────────────────────
  const GITHUB_CLIENT_ID = 'Iv23liDBARfsjA2e1odh';
  let _devicePollTimer = null;

  async function startDeviceFlow() {
    const modal     = document.getElementById('device-modal');
    const codeEl    = document.getElementById('device-code');
    const statusEl  = document.getElementById('device-modal-status');
    const cancelBtn = document.getElementById('device-cancel-btn');
    if (!modal) return;

    statusEl.textContent = '';
    codeEl.textContent   = 'Requesting code…';
    modal.classList.remove('hidden');

    let deviceData;
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_flow: true }),
      });
      if (!res.ok) throw new Error();
      deviceData = await res.json();
    } catch {
      codeEl.textContent   = '';
      statusEl.textContent = 'Could not start login — please try again.';
      return;
    }

    codeEl.textContent = deviceData.user_code;
    document.getElementById('device-open-btn').href = deviceData.verification_uri;

    let pollInterval = Math.max((deviceData.interval || 5) * 1000, 10000);

    function schedulePoll() {
      _devicePollTimer = setTimeout(async () => {
        try {
          const res  = await fetch(LAMBDA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceData.device_code }),
          });
          const data = await res.json();
          statusEl.textContent = data.error === 'authorization_pending' ? 'Waiting for approval...' : (data.error || (data.token ? 'approved' : 'waiting...'));

          if (data.token && data.login) {
            setSession(data.token, data.login);
            modal.classList.add('hidden');
            location.reload();
          } else if (data.error === 'slow_down') {
            pollInterval += 5000;
            schedulePoll();
          } else if (data.error === 'access_denied') {
            statusEl.textContent = 'Login cancelled.';
          } else if (data.error === 'expired_token') {
            statusEl.textContent = 'Code expired — please try again.';
          } else if (data.error && data.error !== 'authorization_pending') {
            statusEl.textContent = `Login failed — ${data.error}`;
          } else {
            schedulePoll();
          }
        } catch (e) {
          statusEl.textContent = `Network error — retrying...`;
          schedulePoll();
        }
      }, pollInterval);
    }

    schedulePoll();

    cancelBtn.onclick = () => {
      clearTimeout(_devicePollTimer);
      modal.classList.add('hidden');
    };
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
    startDeviceFlow();
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
