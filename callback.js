(async () => {
  const LAMBDA_URL = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const status     = document.getElementById('callback-status');

  const params         = new URLSearchParams(location.search);
  const code           = params.get('code');
  const installationId = params.get('installation_id');

  // ─── Step 1: OAuth code → user token (repo creation) ─────────────────────────
  if (code && !installationId) {
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(`Lambda returned ${res.status}`);
      const data = await res.json();
      if (!data.user_token || !data.login) throw new Error(data.error || 'Incomplete response');

      sessionStorage.setItem('autonom_user_token',  data.user_token);
      sessionStorage.setItem('autonom_token_owner', data.login);
      sessionStorage.setItem('autonom_onboarding',  '1');

      status.textContent = 'Connected! Now install the Autonom app...';

      // Step 2: redirect to App installation to get installation token
      setTimeout(() => {
        location.href = `https://github.com/apps/autonom-page/installations/new`;
      }, 800);

    } catch (e) {
      status.textContent = `Login failed — ${e.message}. Please try again.`;
    }
    return;
  }

  // ─── Step 2: installation_id → installation token (content writes) ────────────
  if (installationId) {
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation_id: installationId }),
      });
      if (!res.ok) throw new Error(`Lambda returned ${res.status}`);
      const data = await res.json();
      if (!data.token) throw new Error(data.error || 'No token received');

      sessionStorage.setItem('autonom_token', data.token);

      status.textContent = 'Connected! Redirecting...';

      setTimeout(() => {
        const isOnboarding = sessionStorage.getItem('autonom_onboarding');
        const login        = sessionStorage.getItem('autonom_token_owner');
        location.href = isOnboarding ? 'index.html' : `https://${login}.github.io`;
      }, 600);

    } catch (e) {
      status.textContent = `Login failed — ${e.message}. Please try again.`;
    }
    return;
  }

  status.textContent = 'Login failed — no authorization received. Please try again.';
})();
