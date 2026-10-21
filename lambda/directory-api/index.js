const { DynamoDBClient, PutItemCommand, DeleteItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const TABLE_NAME     = process.env.TABLE_NAME || 'autonom-directory';

const db = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const origin = event.headers?.origin || event.headers?.Origin || '';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Origin lock
  if (origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    if (method === 'GET')    return await handleSearch(event);
    if (method === 'POST')   return await handleUpsert(event);
    if (method === 'DELETE') return await handleDelete(event);
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

// ─── GET /directory?q=searchterm ─────────────────────────────────────────────
async function handleSearch(event) {
  const q = (event.queryStringParameters?.q || '').toLowerCase().trim();

  const result = await db.send(new ScanCommand({
    TableName:        TABLE_NAME,
    FilterExpression: 'listed = :t',
    ExpressionAttributeValues: marshall({ ':t': true }),
    ProjectionExpression: 'github_username, display_name, site_url',
  }));

  let items = (result.Items || []).map(i => unmarshall(i));

  // Filter by query if provided
  if (q) {
    items = items.filter(i =>
      i.display_name?.toLowerCase().includes(q) ||
      i.github_username?.toLowerCase().includes(q)
    );
  }

  // Cap results at 50
  items = items.slice(0, 50);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(items),
  };
}

// ─── POST /directory  { github_username, display_name, site_url } ─────────────
async function handleUpsert(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { github_username, display_name, site_url } = body;

  if (!github_username || !site_url) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'github_username and site_url are required' }) };
  }

  // Validate site_url is a github.io URL or custom domain — basic sanity check
  if (!site_url.startsWith('https://')) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'site_url must be https' }) };
  }

  await db.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: marshall({
      github_username,
      display_name: display_name || github_username,
      site_url,
      listed: true,
      updated_at: new Date().toISOString(),
    }),
  }));

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
}

// ─── DELETE /directory  { github_username } ───────────────────────────────────
async function handleDelete(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { github_username } = body;
  if (!github_username) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'github_username is required' }) };
  }

  await db.send(new DeleteItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ github_username }),
  }));

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
}
