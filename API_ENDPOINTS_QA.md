# API Endpoints for QA

This document is based on the current backend code under `server/src`.

## Base

- Base URL (local): `https://url-rank-checker.onrender.com`
- Health check: `GET /api/health`
- Content type for JSON requests: `Content-Type: application/json`
- Auth header for protected routes: `Authorization: Bearer <jwt_token>`

## Roles and Access

- `admin`: full access
- `manager`: access to `/api/admin/*` (same as admin for admin module)
- `user`: no access to `/api/admin/*` and `/api/users/*`
- `/api/users/*`: `admin` only

## Common Error Responses

- `400` validation/request error
- `401` auth required, invalid token, or invalid credentials
- `403` forbidden by role
- `404` resource not found
- `409` conflict (duplicate or invalid state transition)
- `500` internal server error (`{ error, details }`)

## 1) Health

### GET `/api/health`
- Auth: Public
- Response `200`:
```json
{ "ok": true }
```

## 2) Auth

### POST `/api/auth/login`
- Auth: Public
- Body:
```json
{ "email": "user@example.com", "password": "yourpassword" }
```
- Success `200`:
```json
{
  "token": "<jwt>",
  "user": {
    "_id": "...",
    "username": "...",
    "email": "...",
    "role": "admin|manager|user",
    "isActive": true
  }
}
```
- Errors:
- `400`: `email and password are required`
- `401`: `Invalid credentials`

### GET `/api/auth/me`
- Auth: Bearer token
- Success `200`: current user profile
- Errors: `401`, `404`

### PATCH `/api/auth/me`
- Auth: Bearer token
- Body:
```json
{ "username": "New Name", "email": "new@example.com" }
```
- Success `200`: updated user profile
- Errors:
- `400`: username/email missing
- `409`: email already used
- `401`, `404`

### PATCH `/api/auth/me/password`
- Auth: Bearer token
- Body:
```json
{ "currentPassword": "oldpass", "newPassword": "newpass123" }
```
- Success `200`:
```json
{ "ok": true }
```
- Errors:
- `400`: missing fields or new password < 8 chars
- `401`: current password incorrect
- `404`: user not found

## 3) Brands

### GET `/api/brands`
### GET `/api/brands?active=true`
- Auth: Bearer token
- Success `200`: list of brand objects (sorted by `code`)

### GET `/api/brands/:id`
- Auth: Bearer token
- Success `200`: single brand object
- Errors: `404` brand not found

## 4) Domains

### GET `/api/domains`
### GET `/api/domains?brandId=<brandId>&active=true`
- Auth: Bearer token
- Success `200`: list of domains (includes populated brand fields `name/code/color`)

### POST `/api/domains`
- Auth: Bearer token
- Body:
```json
{ "domain": "example.com", "brandId": "<brandId>", "note": "optional" }
```
- Success `201`: created domain object
- Errors:
- `400`: `domain and brandId are required` or invalid domain
- `404`: brand not found
- `409`: duplicate domain for same brand

### DELETE `/api/domains/:id`
- Auth: Bearer token
- Success `200`:
```json
{ "ok": true }
```
- Errors: `404` domain not found

## 5) SERP Check

### POST `/api/serp/check`
- Auth: Bearer token
- Body:
```json
{
  "brandId": "<brandId>",
  "query": "optional search query",
  "country": "id",
  "isMobile": false
}
```
- `country` allowed values:
`id, us, in, sg, my, th, vn, ph, au, gb, ca, de, fr, jp, kr, cn, sa, ae, tr, br, ru, za`
- Success `200`: SERP run result payload (top-10 result set + ranking summary)
- Errors:
- `400`: Zod validation error (`{ error: "Validation error", details: ... }`)
- upstream fetch failures return `>=500`/`502` style errors

## 6) Analytics

### GET `/api/analytics/brands/:brandId/ranking-history?range=1d|7d|14d|30d`
- Auth: Bearer token
- Success `200`:
- brand summary
- period (`from`, `to`, `range`)
- overall trend (`trend`, `delta`)
- timeline points
- per-domain trend points
- Errors:
- `400`: invalid range
- `404`: brand not found

### GET `/api/analytics/brands/:brandId/recent-auto-checks?limit=5`
- Auth: Bearer token
- `limit` clamped to `1..20` (default `5`)
- Success `200`:
- brand summary
- recent deduplicated auto-check rounds (`runs`)
- Errors: `404` brand not found

## 7) Admin (`admin` and `manager`)

### GET `/api/admin/settings`
- Success `200`: sanitized admin settings

### PATCH `/api/admin/settings/schedule`
- Body (any subset):
```json
{
  "autoCheckEnabled": true,
  "checkIntervalMinutes": 15,
  "checkIntervalHours": 0.25
}
```
- Rules:
- interval must be one of `15, 30, 60` minutes
- if auto-check already running, changing interval can return `409` requiring stop+run
- Success `200`: updated settings
- Errors: `400`, `409`

### PATCH `/api/admin/settings/backup`
- Body (any subset):
```json
{
  "backupEnabled": true,
  "backupFrequency": "daily",
  "backupTimeWib": "09:30",
  "backupFormat": "json",
  "backupTelegramBotToken": "...",
  "backupTelegramChatIds": ["12345"]
}
```
- `backupFrequency`: `daily|twice_weekly|weekly|monthly`
- `backupFormat`: `json|ndjson`
- `backupTimeWib`: `HH:mm`
- Success `200`: updated settings
- Errors: `400` on invalid frequency/format/time

### POST `/api/admin/settings/keys`
- Body:
```json
{ "name": "Key 1", "key": "SERPER_KEY", "isActive": true }
```
- Success `201`: updated sanitized settings
- Errors: `400` name/key required

### PATCH `/api/admin/settings/keys/:keyId`
- Body: any of `name`, `key`, `isActive`
- Success `200`: updated sanitized settings
- Errors: `404` key not found

### DELETE `/api/admin/settings/keys/:keyId`
- Success `200`: updated sanitized settings
- Errors: `404` key not found

### GET `/api/admin/dashboard`
- Success `200`: dashboard payload (settings, token usage, scheduler status, backup runs, last run, auto-check slot statuses)

### GET `/api/admin/domain-logs?limit=100`
- `limit` clamped to `1..200` (default `100`)
- Success `200`: ADD/DELETE domain activity logs

### GET `/api/admin/auto-check-logs?limit=100`
- `limit` clamped to `1..200` (default `100`)
- Success `200`: AUTO_START/AUTO_STOP/AUTO_CHECK logs

### POST `/api/admin/run-now`
- Success `202`:
```json
{ "ok": true, "started": true, "schedulerStatus": { } }
```
- Errors: `500` scheduler unavailable

### POST `/api/admin/backup/run-now`
- Success `202`:
```json
{ "ok": true, "started": true, "backupSchedulerStatus": { } }
```
- Errors: `500` scheduler unavailable

### POST `/api/admin/backup/test-telegram`
- Body (optional override):
```json
{
  "backupTelegramBotToken": "...",
  "backupTelegramChatIds": ["12345"],
  "message": "QA test"
}
```
- Success `200`: test result summary (`ok`, success/fail counts, per-target details)
- Errors: validation/integration failures (`400` or service-defined status)

### POST `/api/admin/stop-run`
- Success `200`:
```json
{
  "ok": true,
  "stopRequested": true,
  "schedulerStatus": { },
  "settings": { }
}
```

## 8) User Management (`admin` only)

### GET `/api/users`
- Success `200`: users list (`username`, `email`, `role`, `isActive`, `createdAt`)

### POST `/api/users`
- Body:
```json
{
  "username": "new user",
  "email": "new@example.com",
  "role": "admin|manager|user",
  "password": "min8chars"
}
```
- Success `201`: created user summary
- Errors:
- `400`: missing fields, invalid role, short password
- `409`: email already exists

### PATCH `/api/users/:id`
- Body: any of `username`, `email`, `role`, `password`, `isActive`
- Success `200`: updated user summary
- Errors:
- `400`: invalid input, self-demote from admin, last active admin protection
- `404`: user not found
- `409`: duplicate email

### DELETE `/api/users/:id`
- Success `200`:
```json
{ "ok": true }
```
- Errors:
- `400`: self-delete blocked or last active admin protection
- `404`: user not found

## QA Smoke Checklist

- Login with valid/invalid credentials.
- Verify protected endpoints reject missing token (`401`).
- Verify role restrictions:
- `user` cannot access `/api/admin/*` and `/api/users/*`.
- `manager` can access `/api/admin/*`.
- Create and delete a domain; check admin domain logs updated.
- Run manual SERP check and verify analytics history updates.
- Trigger admin run-now and stop-run flows.
- Validate 400/404/409 cases per endpoint.
