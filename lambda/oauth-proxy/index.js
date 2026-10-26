const jwt = require('jsonwebtoken');
const https = require('https');

const ALLOWED_ORIGIN     = process.env.ALLOWED_ORIGIN;
const GITHUB_APP_ID      = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');
const GITHUB_CLIENT_ID   = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

function getCorsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || /^https:\/\/[a-z0-9-]+\.github\.io$/.test(origin);
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function signAppJWT() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 600, iss: GITHUB_APP_ID }, GITHUB_PRIVATE_KEY, { algorithm: 'RS256' });
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getLogin(userToken) {
  const { status, body } = await httpsRequest({
    hostname: 'api.github.com',
    path: '/user',
    method: 'GET',
    headers: {
      Authorization: `token ${userToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'autonom-oauth-proxy',
    },
  });
  if (status !== 200) throw new Error('Could not fetch GitHub user');
  return body.login;
}

async function exchangeInstallation(installationId) {
  const appJWT = signAppJWT();
  const { status, body } = await httpsRequest({
    hostname: 'api.github.com',
    path: `/app/installations/${installationId}/access_tokens`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJWT}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'autonom-oauth-proxy',
      'Content-Length': 0,
    },
  });
  if (status !== 201) throw new Error(body.message || 'Installation token exchange failed');
  return body;
}

async function userTokenToInstallToken(userToken) {
  const login = await getLogin(userToken);
  const appJWT = signAppJWT();
  const { status, body } = await httpsRequest({
    hostname: 'api.github.com',
    path: `/users/${login}/installation`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${appJWT}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'autonom-oauth-proxy',
    },
  });
  if (status !== 200) throw new Error('No installation found — please install the GitHub App first');
  const installData = await exchangeInstallation(body.id);
  return { token: installData.token, expires_at: installData.expires_at, login };
}

async function requestDeviceCode() {
  const body = JSON.stringify({ client_id: GITHUB_CLIENT_ID });
  const { status, body: data } = await httpsRequest({
    hostname: 'github.com',
    path: '/login/device/code',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'autonom-oauth-proxy',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (status !== 200 || data.error) throw new Error(data.error || 'Device code request failed');
  return data;
}

async function pollDeviceToken(deviceCode) {
  const body = JSON.stringify({
    client_id: GITHUB_CLIENT_ID,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
  const { status, body: data } = await httpsRequest({
    hostname: 'github.com',
    path: '/login/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'autonom-oauth-proxy',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (status !== 200) throw new Error('Poll failed');
  return data;
}

async function exchangeOAuthCode(code) {
  const body = JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code });
  const { status, body: data } = await httpsRequest({
    hostname: 'github.com',
    path: '/login/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'autonom-oauth-proxy',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (status !== 200 || data.error) throw new Error(data.error_description || 'OAuth exchange failed');
  return data;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const CORS = getCorsHeaders(origin);

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.requestContext?.http?.method !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const isAllowed = origin === ALLOWED_ORIGIN || /^https:\/\/[a-z0-9-]+\.github\.io$/.test(origin);
  if (!isAllowed) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  try {
    // Device flow step 1 — request device+user code
    if (body.device_flow) {
      const data = await requestDeviceCode();
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // Device flow step 2 — poll, then exchange user token for installation token
    if (body.device_code) {
      const data = await pollDeviceToken(body.device_code);
      if (data.error) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: data.error }) };
      }
      const result = await userTokenToInstallToken(data.access_token);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
    }

    // OAuth code exchange — for onboarding repo creation
    if (body.code) {
      const data  = await exchangeOAuthCode(body.code);
      const login = await getLogin(data.access_token);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ user_token: data.access_token, login }) };
    }

    // Installation token exchange — for onboarding content writes
    if (body.installation_id) {
      const data = await exchangeInstallation(body.installation_id);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ token: data.token, expires_at: data.expires_at }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required parameter' }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
