(async () => {
  const LAMBDA_URL = 'https://f8rcwlcsz8.execute-api.us-east-1.amazonaws.com/prod/token';
  const status     = document.getElementById('callback-status');

  const params         = new URLSearchParams(location.search);
  const installationId = params.get('installation_id');

  if (!installationId) {
    status.textContent = 'Login failed — no installation ID received.';
    return;
  }

  let tokenData;
  try {
    const res = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installation_id: installationId }),
    });
    if (!res.ok) throw new Error(`Lambda returned ${res.status}`);
    tokenData = await res.json();
  } catch (e) {
    status.textContent = `Login failed — ${e.message}. Please try again.`;
    return;
  }

  let login;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${tokenData.token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error('Could not verify GitHub identity');
    ({ login } = await res.json());
  } catch (e) {
    status.textContent = e.message;
    return;
  }

  sessionStorage.setItem('autonom_token',       tokenData.token);
  sessionStorage.setItem('autonom_token_owner', login);

  status.textContent = 'Connected! Redirecting...';

  const isOnboarding = sessionStorage.getItem('autonom_onboarding');
  setTimeout(() => {
    location.href = isOnboarding ? 'index.html' : `https://${login}.github.io`;
  }, 600);
})();
