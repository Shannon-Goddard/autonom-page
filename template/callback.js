(async () => {
  const status = document.getElementById('callback-status');
  const params = new URLSearchParams(location.search);
  const installationId = params.get('installation_id');
  const code           = params.get('code');

  if (!installationId && !code) {
    status.textContent = 'Login failed — no credentials received.';
    return;
  }

  let result;

  if (installationId) {
    // First-time install — exchange installation_id directly
    result = await Autonom.exchangeInstallationToken(installationId);
    if (!result) { status.textContent = 'Login failed — could not exchange token.'; return; }

    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${result.token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) { status.textContent = 'Login failed — could not verify identity.'; return; }
    const { login } = await res.json();
    result.login = login;

  } else {
    // Re-auth via OAuth code — Lambda resolves code → login → installation token
    try {
      const res = await fetch(Autonom.LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) { status.textContent = 'Login failed — token exchange error.'; return; }
      result = await res.json(); // { token, expires_at, login }
    } catch {
      status.textContent = 'Login failed — network error.';
      return;
    }
  }

  Autonom.setSession(result.token, result.login);
  status.textContent = 'Logged in! Redirecting...';
  const t = encodeURIComponent(result.token);
  const u = encodeURIComponent(result.login);
  setTimeout(() => {
    location.href = `https://${result.login}.github.io#autonom_token=${t}|${u}`;
  }, 800);
})();
