(async () => {
  const status = document.getElementById('callback-status');
  const params = new URLSearchParams(location.search);
  const installationId = params.get('installation_id');

  if (!installationId) {
    status.textContent = 'Login failed — no installation ID received.';
    return;
  }

  const result = await Autonom.exchangeInstallationToken(installationId);

  if (!result) {
    status.textContent = 'Login failed — could not exchange token. Please try again.';
    return;
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${result.token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    status.textContent = 'Login failed — could not verify GitHub identity.';
    return;
  }

  const { login } = await res.json();
  Autonom.setSession(result.token, login);

  status.textContent = 'Logged in! Redirecting...';
  const t = encodeURIComponent(result.token);
  const u = encodeURIComponent(login);
  setTimeout(() => {
    location.href = `https://${login}.github.io#autonom_token=${t}|${u}`;
  }, 800);
})();
