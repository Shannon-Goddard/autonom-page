const jwt = require('jsonwebtoken');
const https = require('https');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function signAppJWT() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 600, iss: GITHUB_APP_ID }, GITHUB_PRIVATE_KEY, { algorithm: 'RS256' });
}

function githubPost(path, appJWT) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'autonom-oauth-proxy',
        'Content-Length': 0,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Reject non-POST
  if (event.requestContext?.http?.method !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate origin
  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  let installation_id;
  try {
    ({ installation_id } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!installation_id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing installation_id' }) };
  }

  try {
    const appJWT = signAppJWT();
    const { status, body } = await githubPost(`/app/installations/${installation_id}/access_tokens`, appJWT);

    if (status !== 201) {
      return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: 'GitHub token exchange failed', detail: body.message }) };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ token: body.token, expires_at: body.expires_at }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
