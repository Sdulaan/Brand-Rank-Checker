# serp-brand-dashboard

Monorepo dashboard for manual Google Indonesia top-10 checks using **SerpApi** (no scraping).

## Stack

- Backend: Node.js, Express, Mongoose, Zod, PSL
- Frontend: React (Vite), TailwindCSS
- Data source: SerpApi (`gl=id`, `hl=id`, top 10 organic)

## Project Structure

```text
serp-brand-dashboard/
  server/
    src/
      config/
      models/
      routes/
      controllers/
      services/
      utils/
      app.js
      index.js
    scripts/seed.js
    .env
    package.json
  client/
    src/
    package.json
  package.json
```

## Setup

1. **Create MongoDB database**
   - Use local MongoDB or MongoDB Atlas.
2. **Get SerpApi key**
   - Register at https://serpapi.com and copy your API key.
3. **Configure environment variables**
   - Edit `server/.env`:

   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/serp_brand_dashboard
   SERPAPI_KEY=your_serpapi_key_here
   PORT=4000
   ```

4. **Install dependencies**

   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

5. **Seed sample data**

   ```bash
   npm run seed
   ```

6. **Run in development**

   ```bash
   npm run dev
   ```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## API Endpoints

- `GET /api/brands?active=true`
- `GET /api/brands/:id`
- `GET /api/domains?brandId=:id&active=true`
- `POST /api/serp/check` body: `{ "brandId": "...", "query": "optional" }`

## Matching Logic

For each SERP result URL:
1. Exact host key match (`domainHostKey`)
2. Suffix match (`resultHost.endsWith('.' + domainHostKey)` or equals)
3. Token match using indexed tokens (ignore tokens `< 4 chars`)
4. Choose longest matching `domainHostKey` as best match

`Domain` documents store:
- `domainHostKey`
- `domainRootKey` (eTLD+1 via PSL)
- `tokens`

## Notes

- Manual checks only (no scheduler)
- In-memory API cache TTL: 120 seconds
- Includes commented future stubs for SERP history persistence
