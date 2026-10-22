(async () => {
  const LAMBDA_URL = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const status     = document.getElementById('callback-status');

  const params         = new URLSearchParams(location.search);
  const installationId = params.get('installation_id');

  if (!installationId) {
    status.textContent = 'Login failed — no installation ID received.';
    return;
  }

  let login;
  try {
    const res = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installation_id: installationId }),
    });
    if (!res.ok) throw new Error(`Lambda returned ${res.status}`);
    const data = await res.json();
    if (!data.token || !data.login) throw new Error('Incomplete response from auth server');
    sessionStorage.setItem('autonom_token', data.token);
    sessionStorage.setItem('autonom_token_owner', data.login);
    login = data.login;
  } catch (e) {
    status.textContent = `Login failed — ${e.message}. Please try again.`;
    return;
  }

  status.textContent = 'Connected! Redirecting...';

  const isOnboarding = sessionStorage.getItem('autonom_onboarding');
  setTimeout(() => {
    location.href = isOnboarding ? 'index.html' : `https://${login}.github.io`;
  }, 600);
})();
