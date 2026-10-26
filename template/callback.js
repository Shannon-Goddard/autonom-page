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
  try {
    const res = await fetch(Autonom.LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(installationId ? { installation_id: installationId } : { code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      status.textContent = `Login failed — ${err.error || res.status}`;
      return;
    }
    result = await res.json(); // { token, expires_at, login }
  } catch {
    status.textContent = 'Login failed — network error.';
    return;
  }

  if (!result.token || !result.login) {
    status.textContent = 'Login failed — incomplete response.';
    return;
  }

  Autonom.setSession(result.token, result.login);
  status.textContent = 'Logged in! Redirecting...';
  const t = encodeURIComponent(result.token);
  const u = encodeURIComponent(result.login);
  setTimeout(() => {
    location.href = `https://${result.login}.github.io#autonom_token=${t}|${u}`;
  }, 800);
})();
