const jwt = require('jsonwebtoken');
const https = require('https');

const ALLOWED_ORIGIN    = process.env.ALLOWED_ORIGIN;
const GITHUB_APP_ID     = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');
const GITHUB_CLIENT_ID  = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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

// Exchange OAuth code → user token → login → installation_id → installation token
async function exchangeCodeForInstallToken(code) {
  // Step 1: exchange code for user token
  const oauthBody = JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code });
  const { status: s1, body: d1 } = await httpsRequest({
    hostname: 'github.com',
    path: '/login/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'autonom-oauth-proxy',
      'Content-Length': Buffer.byteLength(oauthBody),
    },
  }, oauthBody);
  if (s1 !== 200 || d1.error) throw new Error(d1.error_description || 'OAuth exchange failed');
  const userToken = d1.access_token;

  // Step 2: get login
  const login = await getLogin(userToken);

  // Step 3: find their installation via App JWT
  const appJWT = signAppJWT();
  const { status: s3, body: d3 } = await httpsRequest({
    hostname: 'api.github.com',
    path: `/users/${login}/installation`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${appJWT}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'autonom-oauth-proxy',
    },
  });
  if (s3 !== 200) throw new Error('No installation found for this user — please install the GitHub App first');
  const installationId = d3.id;

  // Step 4: exchange installation_id for scoped token
  const data = await exchangeInstallation(installationId);
  return { token: data.token, expires_at: data.expires_at, login };
}

// Get username from user token
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

// Exchange installation_id for installation access token
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
  return body; // { token, expires_at }
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.requestContext?.http?.method !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  try {
    // OAuth code exchange — get installation token via code → login → installation
    if (body.code) {
      const data = await exchangeCodeForInstallToken(body.code);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ token: data.token, expires_at: data.expires_at, login: data.login }),
      };
    }

    // Installation token exchange — returns scoped token + login for content writes
    if (body.installation_id) {
      const data = await exchangeInstallation(body.installation_id);
      // Get login via App JWT — installation tokens can't call /user
      const appJWT = signAppJWT();
      const { status, body: inst } = await httpsRequest({
        hostname: 'api.github.com',
        path: `/app/installations/${body.installation_id}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${appJWT}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'autonom-oauth-proxy',
        },
      });
      const login = status === 200 ? inst.account?.login : null;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ token: data.token, expires_at: data.expires_at, login }),
      };
    }

    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing code or installation_id' }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
