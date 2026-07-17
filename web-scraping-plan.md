# Web Scraping Pipeline — Prague Dance Events

## Overview

Extend the existing Dance Prague aggregator with a second data pipeline that finds events on the open web (not just Facebook). Uses Apify's Google Search Scraper to find relevant pages, then GPT-4o-mini to extract structured event data from each page's HTML content.

**Approach:** Option C — Google Search Scraper + AI extraction

**New data flow:**
Apify Google Search Scraper (weekly) → webhook → `/api/web-ingest` → fetch each result page → GPT-4o-mini extracts events → upsert into Supabase `events` table

**Key decisions made:**
- GPT-4o-mini for extraction (not GPT-4o) — sufficient for structured HTML extraction, negligible cost
- Deduplication via `source_url` (new column) for web events, existing `facebook_event_id` for Facebook events
- New `source` column (`facebook` | `web`) to distinguish origin
- Same `events` table — web events show on the site exactly like Facebook events

---

## Sub-Tasks

---

### 1. Supabase Schema Migration

**Status:** [x] done

**Intent:**
Add two new columns to the existing `events` table to support web-scraped events: `source` (which pipeline created it) and `source_url` (deduplication key for web events).

**Expected Outcomes:**
- `events` table has `source text not null default 'facebook'` column
- `events` table has `source_url text` column (nullable, unique where not null)
- Existing Facebook events are unaffected (they get `source = 'facebook'`, `source_url = null`)
- A unique partial index on `source_url` where it is not null prevents web event duplicates

**Todo List:**
1. Create `supabase/add_web_scraping_columns.sql`:
   ```sql
   alter table public.events
     add column if not exists source text not null default 'facebook',
     add column if not exists source_url text;

   create unique index if not exists events_source_url_unique
     on public.events (source_url)
     where source_url is not null;
   ```
2. Run the migration in Supabase SQL Editor
3. Update `types/event.ts` to add `source: string` and `source_url: string | null` fields

**Relevant Context:**
- `supabase/schema.sql` has the original schema for reference
- `types/event.ts` is used by the frontend and all API routes

---

### 2. GPT-4o-mini Web Event Extractor

**Status:** [x] done

**Intent:**
Create a function that takes a webpage's text content and URL, and uses GPT-4o-mini to extract a list of structured dance events from it.

**Expected Outcomes:**
- `lib/extract-web-events.ts` exports `extractWebEvents(pageText: string, pageUrl: string): Promise<WebEvent[]>`
- Returns an array of zero or more events — zero if the page has no relevant events
- Each `WebEvent` has: `title`, `description`, `start_at` (ISO string), `end_at` (ISO string | null), `location_name`, `cover_image_url` (null — web pages rarely have usable images), `facebook_url` (null), `source_url` (the page URL), `dance_styles` (classified inline by the same prompt)
- GPT-4o-mini prompt instructs: extract only upcoming social dance events (not lessons), return a JSON array, include dance style classification in the same call (saves a second API call vs the Facebook pipeline)
- On parse error or empty page, returns `[]`

**Relevant Context:**
- `lib/openai.ts` exports `getOpenAI()` — reuse this
- `lib/classify.ts` for reference on how the existing classifier prompt is structured
- Combine extraction + classification into one prompt to halve API calls

---

### 3. `/api/web-ingest` Route

**Status:** [x] done

**Intent:**
Create a new API route that Apify calls after each Google Search scrape run. For each search result URL, it fetches the page, passes the text to the extractor, and upserts events into Supabase.

**Expected Outcomes:**
- `POST /api/web-ingest` validates the same `x-apify-webhook-secret`
- Fetches the Apify dataset (Google Search Scraper output contains result URLs + snippets)
- For each result URL: fetches the page HTML, strips to plain text (remove scripts/styles/nav), passes to `extractWebEvents`
- Upserts each extracted event into `events` table with `source = 'web'` and `source_url` set
- Upsert conflict target: `source_url` (for web events)
- Skips URLs that time out or return non-200 (with `Promise.allSettled`)
- Calls `revalidatePath('/')` after processing
- Returns `{ ok: true, processed: N, pagesScraped: M }`

**Relevant Context:**
- `app/api/ingest/route.ts` for the existing pattern to follow
- `lib/supabase.ts` `getSupabaseAdmin()` for writes
- HTML stripping: use a simple regex to remove `<script>`, `<style>`, HTML tags — no extra dependency needed
- Limit page text to first 6000 chars before sending to GPT to control token cost
- Process pages in batches of 5 (each page fetch + GPT call is slower than the Facebook pipeline)

---

### 4. Apify Google Search Scraper Task

**Status:** [ ] pending

**Intent:**
Configure a new Apify task using the Google Search Scraper Actor to run the search queries weekly and fire the `/api/web-ingest` webhook.

**Expected Outcomes:**
- A third Apify task exists using the "Google Search Scraper" Actor
- Configured with the Prague dance event search queries
- Webhook fires `POST /api/web-ingest` on run success
- Scheduled weekly (different day from discovery task to spread load)
- `APIFY_SETUP.md` updated with Task 3 config

**Search queries to configure:**
```
salsa social dance Prague 2026
bachata social Prague 2026
milonga tango Prague 2026
swing dance social Prague 2026
latin dance party Prague 2026
kizomba Prague social 2026
open air dance Prague 2026
tanec Praha social 2026
```

**Todo List:**
1. Deploy the `/api/web-ingest` route to Vercel first
2. In Apify Store, find "Google Search Scraper" (by Apify)
3. Create a new task with the search queries above, `maxPagesPerQuery: 3`, `resultsPerPage: 10`
4. Add webhook: `POST https://dance-hub-one.vercel.app/api/web-ingest`, same secret header
5. Schedule: `0 10 * * 3` (every Wednesday 10am UTC — different from Facebook daily and discovery Monday)
6. Update `APIFY_SETUP.md` with Task 3 details

**Relevant Context:**
- Google Search Scraper output format: each item has `url`, `title`, `description` (snippet)
- We only need the `url` from each result to then fetch the full page

---

### 5. Frontend: Show Event Source

**Status:** [ ] pending

**Intent:**
Small UI addition to show users where each event came from — a subtle "Web" or "Facebook" badge on each card, so users know the source and can trust the data appropriately.

**Expected Outcomes:**
- Each `EventCard` shows a small source badge (e.g. "📘 Facebook" or "🌐 Web") at the bottom of the card, next to the "View on Facebook →" link
- For web events, the CTA changes from "View on Facebook →" to "View event →" (since `facebook_url` will be null and `source_url` is the link)
- The link for web events points to `source_url`

**Relevant Context:**
- `components/EventCard.tsx` — the only file that needs changing
- `types/event.ts` — `source` and `source_url` will be available after sub-task 1

---

## Updated Architecture

```
Facebook pipeline (daily):
  Apify Facebook scraper → /api/ingest → classify → events (source=facebook)

Web pipeline (weekly, Wednesday):
  Apify Google Search → /api/web-ingest → fetch pages → GPT extract+classify → events (source=web)

Discovery pipeline (weekly, Monday):
  Apify keyword search → /api/discovery → discovery_candidates (manual review)

All events → Next.js (force-dynamic) → EventCard grid + StyleFilter
```
