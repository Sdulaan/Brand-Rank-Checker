# serp-brand-dashboard

Monorepo dashboard for Google Indonesia top-10 checks using Serper API, with manual checks, automatic scheduled checks, key rotation, and ranking analytics.

## Stack

- Backend: Node.js, Express, Mongoose, Zod, PSL
- Frontend: React (Vite), TailwindCSS
- Data source: Serper (`gl=id`, `hl=id`, top 10 organic)

## Setup

1. Create MongoDB database.
2. Configure environment variables in `server/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/serp_brand_dashboard
PORT=4000
SERPER_API_KEYS=key_one,key_two,key_three
```

Notes:
- `SERPER_API_KEYS` supports one or more keys (comma-separated).
- Backward compatible fallbacks also work: `SERPER_API_KEY` or `SERPAPI_KEY`.

3. Install dependencies:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

4. Run development:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Main Features

- Manual top-10 check by brand (`/api/serp/check`)
- Persistent SERP run history in MongoDB
- Automatic checks for all active brands on configurable interval (1h/2h/3h/etc.)
- Admin configuration page for:
  - auto-check toggle and interval
  - add/edit/disable/delete multiple API keys
  - token remaining and per-key usage visibility
  - run automatic check immediately
- API key rotation with fallback when rate-limited/exhausted
- Ranking analytics page by brand with range filters:
  - 1 day, 7 days, 14 days, 30 days

## API Endpoints

- `GET /api/brands?active=true`
- `POST /api/serp/check`
- `GET /api/analytics/brands/:brandId/ranking-history?range=1d|7d|14d|30d`
- `GET /api/admin/dashboard`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings/schedule`
- `POST /api/admin/settings/keys`
- `PATCH /api/admin/settings/keys/:keyId`
- `DELETE /api/admin/settings/keys/:keyId`
- `POST /api/admin/run-now`
