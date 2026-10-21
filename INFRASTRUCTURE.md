# Autonom Infrastructure

This document covers the AWS backend that powers the Autonom platform. The infrastructure was built using Amazon Q Developer (AI assistant) directly from the CLI — no console clicking, no manual zipping, no copy-pasting ARNs between tabs. The architecture and design decisions were made by [@Shannon-Goddard](https://github.com/Shannon-Goddard).

---

## What Was Deployed

### AWS Lambda — `autonom-oauth-proxy`
A stateless Node.js function that handles GitHub App installation token exchange. The browser never touches the GitHub API directly for auth — it sends an `installation_id` to this Lambda, which signs a short-lived JWT with the GitHub App's private key and exchanges it for an installation access token.

**Why Lambda?** The GitHub App private key cannot exist in client-side JavaScript. Lambda is the secure middleman — the key lives in an environment variable, never in code, never in any repo.

### AWS Lambda — `autonom-directory-api`
Handles the opt-in user directory. Three operations: `GET /directory?q=` (search), `POST /directory` (upsert listing), `DELETE /directory` (remove listing). Reads/writes to DynamoDB. Called by `admin.js` when the owner toggles directory listing on or off.

**Least-privilege IAM:** inline policy on `autonom-lambda-role` grants only `dynamodb:PutItem`, `dynamodb:DeleteItem`, `dynamodb:Scan` on the specific table ARN — nothing else.

### DynamoDB — `autonom-directory`
On-demand billing. Partition key: `github_username` (String). Attributes: `display_name`, `site_url`, `listed` (Boolean), `updated_at`. Stores nothing else — no email, no content, no tracking.

### API Gateway (HTTP API) — `autonom-oauth-proxy` (shared)
All routes on the same API ID `f8rcwlcsz8`:

| Route | Lambda | Purpose |
|---|---|---|
| `POST /token` | `autonom-oauth-proxy` | GitHub App token exchange |
| `GET /directory` | `autonom-directory-api` | Search directory |
| `POST /directory` | `autonom-directory-api` | Upsert listing |
| `DELETE /directory` | `autonom-directory-api` | Remove listing |

**Throttling:** 10 RPS, burst 50 — applied at stage level, covers all routes.

---

## GitHub App Setup

The platform uses a **GitHub App** (not a standard OAuth App). The distinction matters:

- Standard OAuth returns a `code` you exchange for a token
- GitHub App installation returns an `installation_id` — you exchange that for a scoped installation access token using a JWT signed with your App's private key

**App name:** `autonom-page`  
**App ID:** stored in Lambda env var `GITHUB_APP_ID`  
**Private key:** stored in Lambda env var `GITHUB_PRIVATE_KEY` — never in code

**Permissions granted (minimum viable scope):**
| Permission | Level |
|---|---|
| Contents | Read and write |
| Issues | Read and write |
| Pages | Read and write |
| Metadata | Read-only (mandatory) |

---

## Environment Variables (Lambda)

| Variable | Value |
|---|---|
| `ALLOWED_ORIGIN` | `https://autonom.page` |
| `GITHUB_APP_ID` | Your GitHub App ID |
| `GITHUB_PRIVATE_KEY` | Full PEM contents (newlines as `\n`) |

---

## CORS Policy

`Access-Control-Allow-Origin` is locked to `https://autonom.page` — never `*`. A wildcard would allow any site on the internet to route installation codes through this proxy. The allowed origin is stored as a Lambda env var so it can be updated without a code redeploy if the domain ever changes.

---

## Token Flow

```
User clicks "Get Started"
        │
        ▼
Redirected to github.com/apps/autonom-page/installations/new
        │
        ▼
GitHub redirects back to autonom.page/callback?installation_id=xxxxx
        │
        ▼
Browser POSTs installation_id to Lambda endpoint
        │
        ▼
Lambda signs JWT with private key
Lambda calls POST /app/installations/{id}/access_tokens
        │
        ▼
Lambda returns { token, expires_at } to browser
Browser stores token in sessionStorage only — never written to any file or repo
```

---

## Reproducing This Setup

If you're forking Autonom for your own project, here's the exact CLI sequence used to deploy this from scratch:

```bash
# 1. Install dependencies and zip
cd lambda/oauth-proxy && npm install
Compress-Archive -Path './lambda/oauth-proxy/*' -DestinationPath './lambda/oauth-proxy.zip'

# 2. Create IAM role
aws iam create-role \
  --role-name autonom-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy \
  --role-name autonom-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 3. Deploy Lambda
aws lambda create-function \
  --function-name autonom-oauth-proxy \
  --runtime nodejs22.x \
  --role arn:aws:iam::<ACCOUNT_ID>:role/autonom-lambda-role \
  --handler index.handler \
  --zip-file fileb://lambda/oauth-proxy.zip \
  --timeout 10 \
  --memory-size 128

# 4. Set environment variables
aws lambda update-function-configuration \
  --function-name autonom-oauth-proxy \
  --environment "Variables={ALLOWED_ORIGIN=https://yourdomain.com,GITHUB_APP_ID=<APP_ID>,GITHUB_PRIVATE_KEY='<PEM_CONTENTS>'}"

# 5. Create API Gateway
aws apigatewayv2 create-api \
  --name autonom-oauth-proxy \
  --protocol-type HTTP

aws apigatewayv2 create-integration \
  --api-id <API_ID> \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:autonom-oauth-proxy \
  --payload-format-version 2.0

aws apigatewayv2 create-route \
  --api-id <API_ID> \
  --route-key "POST /token" \
  --target "integrations/<INTEGRATION_ID>"

aws apigatewayv2 create-stage \
  --api-id <API_ID> \
  --stage-name prod \
  --auto-deploy \
  --default-route-settings "ThrottlingBurstLimit=50,ThrottlingRateLimit=10"

aws lambda add-permission \
  --function-name autonom-oauth-proxy \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:<ACCOUNT_ID>:<API_ID>/*"
```

Replace `<ACCOUNT_ID>`, `<API_ID>`, `<INTEGRATION_ID>`, `<APP_ID>`, and `<PEM_CONTENTS>` with your own values.

### Reproducing `autonom-directory-api` + DynamoDB

```bash
# 1. Create DynamoDB table
aws dynamodb create-table \
  --table-name autonom-directory \
  --attribute-definitions AttributeName=github_username,AttributeType=S \
  --key-schema AttributeName=github_username,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# 2. Attach DynamoDB policy to existing Lambda role
aws iam put-role-policy \
  --role-name autonom-lambda-role \
  --policy-name autonom-dynamodb-directory \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:DeleteItem","dynamodb:Scan"],"Resource":"arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/autonom-directory"}]}'

# 3. Zip and deploy Lambda
Compress-Archive -Path './lambda/directory-api/*' -DestinationPath './lambda/directory-api.zip'

aws lambda create-function \
  --function-name autonom-directory-api \
  --runtime nodejs22.x \
  --role arn:aws:iam::<ACCOUNT_ID>:role/autonom-lambda-role \
  --handler index.handler \
  --zip-file fileb://lambda/directory-api.zip \
  --timeout 10 --memory-size 128

aws lambda update-function-configuration \
  --function-name autonom-directory-api \
  --environment "Variables={ALLOWED_ORIGIN=https://autonom.page,TABLE_NAME=autonom-directory}"

# 4. Add routes to existing API Gateway
aws apigatewayv2 create-integration \
  --api-id <API_ID> \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:autonom-directory-api \
  --payload-format-version 2.0

aws apigatewayv2 create-route --api-id <API_ID> --route-key "GET /directory"    --target "integrations/<INTEGRATION_ID>"
aws apigatewayv2 create-route --api-id <API_ID> --route-key "POST /directory"   --target "integrations/<INTEGRATION_ID>"
aws apigatewayv2 create-route --api-id <API_ID> --route-key "DELETE /directory" --target "integrations/<INTEGRATION_ID>"

# 5. Grant API Gateway invoke permission
aws lambda add-permission \
  --function-name autonom-directory-api \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:<ACCOUNT_ID>:<API_ID>/*"
```

---

## Cost

Effectively $0 at this scale. Lambda free tier covers 1M requests/month. API Gateway HTTP API is $1 per million requests. DynamoDB (added in Phase 3) on-demand pricing is fractions of a cent at hobbyist traffic levels.
