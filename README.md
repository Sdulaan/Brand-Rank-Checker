# URL Rank Checker – Google Custom Search Setup

To run this project with Google Programmable Search, you need two values:

- `GOOGLE_API_KEY`
- `GOOGLE_CSE_CX` (the Programmable Search Engine ID, often called `cx`)

## 1) Create a Google API key

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Custom Search API** for that project:
   - APIs & Services → Library → search for **Custom Search API** → Enable.
4. Create credentials:
   - APIs & Services → Credentials → **Create credentials** → **API key**.
5. (Recommended) Restrict the key:
   - Under the key settings, add API restrictions for **Custom Search API**.
   - Add HTTP referrer / IP restrictions as needed for your environment.

Save this value as `GOOGLE_API_KEY`.

## 2) Create a Programmable Search Engine and get `cx`

1. Open [Programmable Search Engine](https://programmablesearchengine.google.com/).
2. Click **Add** to create a new search engine.
3. For “Sites to search”, either:
   - enter specific domains, or
   - create the engine first and later configure it to search the entire web.
4. Finish creation, then open your search engine’s **Control Panel**.
5. Copy the **Search engine ID**. This is your `cx` value.

Save this value as `GOOGLE_CSE_CX`.

## 3) Put values into your environment

Set these variables before running the app:

```bash
export GOOGLE_API_KEY="your_api_key_here"
export GOOGLE_CSE_CX="your_cx_here"
```

Or in a `.env` file (if your runtime loads it):

```dotenv
GOOGLE_API_KEY=your_api_key_here
GOOGLE_CSE_CX=your_cx_here
```

## 4) Quick verification

You can test both values with a direct API call:

```bash
curl "https://www.googleapis.com/customsearch/v1?key=$GOOGLE_API_KEY&cx=$GOOGLE_CSE_CX&q=openai"
```

If configured correctly, you should receive JSON containing search results.
