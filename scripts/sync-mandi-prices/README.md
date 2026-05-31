# sync-mandi-prices

One-shot Node script that pulls daily APMC prices from **data.gov.in
(Agmarknet)** and writes them to **Firebase Realtime Database** at
`/crop-prices`, with a `_meta.lastSyncAt` timestamp.

The browser-side `usePrices` hook reads from Firebase and only falls back to a
direct OGD call when this sync is stale (older than 35 minutes). At a 30-min
cadence the cron makes **~48 OGD calls/day** regardless of traffic, well
inside the free 5 000/day quota.

## Why?

| Without this sync                          | With this sync                          |
|-------------------------------------------|----------------------------------------|
| Every page load may hit OGD = quota burn  | One OGD call per 30 min, fixed cost   |
| Cold start latency = OGD round-trip       | Page paints from Firebase in < 200 ms |
| OGD outage = blank prices                 | OGD outage = stale-but-present prices |

## Env

```
DATA_GOV_KEY                 free key from https://data.gov.in/user
FIREBASE_DATABASE_URL        https://<project>-default-rtdb.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS  path to service-account JSON
STATE_FILTER                 (optional) e.g. "Maharashtra"
RECORD_LIMIT                 (optional) default 2000
```

## Run locally

```bash
cd scripts/sync-mandi-prices
npm install
DATA_GOV_KEY=<key> \
FIREBASE_DATABASE_URL=https://your-roots-6874d-default-rtdb.firebaseio.com \
GOOGLE_APPLICATION_CREDENTIALS=./sa.json \
npm start
```

## Schedule recipes

### A. Google Cloud Scheduler → Cloud Run job (recommended on GCP)

```bash
# Build the image
gcloud builds submit . --tag gcr.io/your-roots-6874d/sync-mandi-prices

# Create the Cloud Run Job (no traffic — invoked by scheduler)
gcloud run jobs create sync-mandi-prices \
  --image gcr.io/your-roots-6874d/sync-mandi-prices \
  --region asia-south1 \
  --set-env-vars DATA_GOV_KEY=...,FIREBASE_DATABASE_URL=...

# Wire a 30-min schedule
gcloud scheduler jobs create http sync-mandi-prices-30m \
  --schedule "*/30 * * * *" \
  --uri "https://asia-south1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/your-roots-6874d/jobs/sync-mandi-prices:run" \
  --http-method POST \
  --oauth-service-account-email <runner-sa>@your-roots-6874d.iam.gserviceaccount.com \
  --location asia-south1
```

### B. GitHub Actions (free, runs on github.com)

`.github/workflows/sync-prices.yml`:

```yaml
name: sync-mandi-prices
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch: {}
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: frontend/rng-market/scripts/sync-mandi-prices
      - run: |
          echo '${{ secrets.GCP_SA_JSON }}' > /tmp/sa.json
        env: { GCP_SA_JSON: ${{ secrets.GCP_SA_JSON }} }
      - run: npm start
        working-directory: frontend/rng-market/scripts/sync-mandi-prices
        env:
          DATA_GOV_KEY:                  ${{ secrets.DATA_GOV_KEY }}
          FIREBASE_DATABASE_URL:         ${{ secrets.FIREBASE_DATABASE_URL }}
          GOOGLE_APPLICATION_CREDENTIALS: /tmp/sa.json
```

### C. Plain unix cron

```cron
*/30 * * * *  cd /opt/sync-mandi-prices && /usr/bin/node sync.mjs >> /var/log/sync.log 2>&1
```

## What the script writes

```jsonc
// /crop-prices in Firebase RTDB
{
  "_meta": { "lastSyncAt": 1717180800000, "recordCount": 412, "source": "data.gov.in" },
  "maharashtra": {
    "nashik": {
      "tomato":  { "crop": "Tomato",  "state": "Maharashtra", "district": "Nashik",
                   "market": "Lasalgaon APMC", "price": 1840, "prevPrice": 1520,
                   "unit": "quintal", "updatedAt": 1717180800000 }
    }
  }
}
```

The browser-side `usePrices` hook treats `_meta.lastSyncAt` as the source of
truth for freshness — anything within the last 35 min is considered "live"
and renders without an extra OGD round-trip.
