# serp-dashboard

Monorepo MERN + Tailwind app for manual SERP top-10 checks using Google Custom Search JSON API (Indonesia targeting).

## Structure

- `server` - Express + Mongoose API
- `client` - React + Vite + Tailwind UI

## Prerequisites

- Node.js 18+
- MongoDB running locally or remotely
- Google Programmable Search Engine credentials

## Google API setup

1. Open Google Cloud Console and enable **Custom Search API**.
2. Create an API key (`GOOGLE_API_KEY`).
3. Open Programmable Search Engine control panel and create a CSE.
4. Get the search engine ID (`GOOGLE_CSE_CX`).
5. Put both values in `server/.env` (copy from `.env.example`).

## Server setup

```bash
cd server
cp .env.example .env
npm i
npm run seed
npm run dev
```

Server runs on `http://localhost:5000`.

## Client setup

```bash
cd client
npm i
npm run dev
```

Client runs on `http://localhost:5173` and proxies `/api` to the server.

## API endpoints

- `GET /api/brands?active=true`
- `POST /api/serp/check`
  - body: `{ "brandId": "...", "query": "optional" }`
