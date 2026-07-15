# Apify Setup Guide

Both tasks use the **Facebook Events Scraper** Actor from the Apify Store.
Same Actor, same webhook secret, different endpoints and schedules.

---

## Task 1 — Production (runs daily)

Scrapes events → classifies with AI → writes to `events` table → shows on site.

### Input
```json
{
  "searchQueries": [
    "salsa Praha",
    "bachata Praha",
    "tango Praha milonga",
    "swing Praha",
    "kizomba Praha",
    "zouk Praha",
    "tanec Praha",
    "dancing Prague"
  ],
  "maxItems": 100
}
```

> **Tip:** As you discover good Facebook pages via the discovery task, add them to `startUrls` here too:
> ```json
> { "startUrls": ["https://www.facebook.com/some-dance-page"] }
> ```

### Webhook
- **Type:** HTTP
- **Event:** `Actor run succeeded`
- **URL:** `https://dance-hub-one.vercel.app/api/ingest`
- **Headers:**
```json
{ "x-apify-webhook-secret": "<your-APIFY_WEBHOOK_SECRET>" }
```

### Schedule
`0 8 * * *` — every day at 8am UTC

---

## Task 2 — Discovery (runs weekly)

Keyword searches → writes to `discovery_candidates` table → you review manually in Supabase.

### Input
```json
{
  "searchQueries": [
    "salsa Praha social",
    "bachata Praha social",
    "tango Praha open",
    "swing Praha dance",
    "kizomba Praha party",
    "zouk Praha",
    "tanec Praha open air",
    "dancing Prague open air"
  ],
  "maxItems": 50
}
```

### Webhook
- **Type:** HTTP
- **Event:** `Actor run succeeded`
- **URL:** `https://dance-hub-one.vercel.app/api/discovery`
- **Headers:**
```json
{ "x-apify-webhook-secret": "<your-APIFY_WEBHOOK_SECRET>" }
```

### Schedule
`0 9 * * 1` — every Monday at 9am UTC

---

## Discovery Review Workflow

1. Go to **Supabase → Table Editor → discovery_candidates**
2. Filter `reviewed = false` to see new candidates
3. For each promising Facebook page/group URL:
   - Add it to the production task's `startUrls` input in Apify
4. Set `reviewed = true` on the row so it doesn't show up again
