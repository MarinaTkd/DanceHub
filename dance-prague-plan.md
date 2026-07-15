# Dance Prague — Open Events Aggregator

## Overview

Build a public website that aggregates open social dancing events in Prague (not lessons — social dances, open-air events, milongas, etc.) into one place. Users can browse all upcoming events and filter by dance style.

**Stack:**
- **Frontend:** Next.js (React), deployed on Vercel
- **Database:** Supabase (PostgreSQL)
- **Scraping:** Apify (Facebook Events scraper, scheduled daily)
- **AI tagging:** OpenAI GPT-4o-mini (dance style classification)
- **Language:** English UI, event content as-is (Czech or English)

**Data flow:**
Apify scrapes Facebook → webhook triggers Next.js API route → GPT-4o-mini classifies dance style → event written to Supabase → Next.js frontend reads from Supabase

**Non-goals:**
- No admin UI (direct Supabase table editor used for manual corrections)
- No user accounts or submissions
- No other sources at launch (Meetup, Instagram added later)
- No i18n / Czech translation

---

## Sub-Tasks

---

### 1. Supabase Schema Setup

**Status:** [x] done

**Intent:**
Define and create the PostgreSQL schema in Supabase that stores all scraped and classified events.

**Expected Outcomes:**
- A `events` table exists in Supabase with the correct columns
- A `source_pages` table exists to hold the curated list of Facebook pages/groups to scrape
- Row-level security is configured (public read, no public write)

**Todo List:**
1. Create a Supabase project
2. Create the `events` table with columns:
   - `id` (uuid, primary key, default gen_random_uuid())
   - `facebook_event_id` (text, unique) — deduplication key
   - `title` (text)
   - `description` (text)
   - `start_at` (timestamptz)
   - `end_at` (timestamptz, nullable)
   - `location_name` (text, nullable)
   - `location_address` (text, nullable)
   - `cover_image_url` (text, nullable)
   - `facebook_url` (text)
   - `dance_styles` (text[], default '{}') — AI-assigned tags
   - `is_visible` (boolean, default true) — manual hide flag
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())
3. Create the `source_pages` table with columns:
   - `id` (uuid, primary key)
   - `facebook_url` (text, unique) — page or group URL
   - `label` (text) — human-readable name
   - `dance_style_hint` (text, nullable) — optional hint for AI classifier
   - `is_active` (boolean, default true)
4. Enable Row Level Security on both tables; add a policy allowing public SELECT on `events` where `is_visible = true`
5. Note the Supabase project URL and anon key for use in later sub-tasks

**Relevant Context:**
- Supabase dashboard: https://app.supabase.com
- `dance_styles` is an array so one event can have multiple tags (e.g. `['salsa', 'bachata']`)
- `facebook_event_id` unique constraint is the deduplication mechanism — re-scraping the same event does an upsert

---

### 2. Next.js Project Scaffolding

**Status:** [x] done

**Intent:**
Bootstrap the Next.js application with the folder structure, environment variable configuration, and core dependencies needed by all subsequent sub-tasks.

**Expected Outcomes:**
- A working Next.js 14+ app (App Router) committed to a git repo
- Supabase JS client configured and accessible
- Environment variables documented in `.env.example`
- Project deploys successfully to Vercel (blank page is fine at this stage)

**Todo List:**
1. Run `npx create-next-app@latest dance-prague --typescript --tailwind --app --no-src-dir`
2. Install dependencies: `@supabase/supabase-js`, `openai`
3. Create `lib/supabase.ts` — exports a Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Create `lib/openai.ts` — exports an OpenAI client using `OPENAI_API_KEY`
5. Create `.env.example` documenting all required env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `APIFY_WEBHOOK_SECRET` (used to authenticate inbound Apify webhooks)
6. Connect the repo to Vercel and confirm a successful deploy

**Relevant Context:**
- App Router is used throughout (no `pages/` directory)
- Tailwind is used for all styling — no CSS-in-JS

---

### 3. Apify Ingest API Route

**Status:** [x] done

**Intent:**
Create a Next.js API route that Apify calls (via webhook) after each scrape run completes. The route fetches the scraped events from Apify's dataset, classifies each event's dance style using GPT-4o-mini, and upserts them into Supabase.

**Expected Outcomes:**
- `POST /api/ingest` accepts a signed Apify webhook payload
- For each event in the Apify dataset: dance style is classified and the event is upserted into the `events` table (no duplicates on re-run)
- Unknown or irrelevant events (e.g. lessons accidentally scraped) get `dance_styles = ['other']` and `is_visible = false`
- The route returns 200 on success, 401 on bad secret, 500 on error

**Todo List:**
1. Create `app/api/ingest/route.ts`
2. Validate the `x-apify-webhook-secret` header against `APIFY_WEBHOOK_SECRET` env var; return 401 if mismatch
3. Extract the Apify `defaultDatasetId` from the webhook body
4. Fetch all items from the dataset using the Apify REST API (`https://api.apify.com/v2/datasets/{id}/items`)
5. For each item, call the GPT-4o-mini classifier (see classifier logic below)
6. Upsert each event into Supabase `events` table on conflict of `facebook_event_id`
7. Events whose classified style is `['other']` should also set `is_visible = false`

**Classifier logic (GPT-4o-mini):**
- System prompt: "You are a dance event classifier. Given an event title and description, return a JSON array of dance styles from this list: salsa, bachata, kizomba, tango, swing, lindy hop, zouk, west coast swing, hustle, folk, other. Return only styles that clearly apply. If the event is a class or lesson rather than a social dance, return ['lesson']. If unclear, return ['other']."
- Input: event title + first 500 chars of description
- Output: parsed JSON array of strings
- Events classified as `['lesson']` should set `is_visible = false`

**Relevant Context:**
- `lib/supabase.ts` and `lib/openai.ts` from sub-task 2
- Apify dataset items API: `https://api.apify.com/v2/datasets/{datasetId}/items?token={APIFY_TOKEN}`
- Use `upsert` with `onConflict: 'facebook_event_id'` in the Supabase JS client

---

### 4. Apify Actor Configuration

**Status:** [ ] pending

**Intent:**
Set up and configure the Apify Facebook Events scraper to run daily against the curated list of Prague dance source pages, and wire up the webhook to the `/api/ingest` endpoint.

**Expected Outcomes:**
- An Apify Actor run (using the `apify/facebook-events-scraper` Actor or equivalent) is scheduled to run once per day
- The Actor is configured to scrape the initial curated list of Prague dance Facebook pages/groups
- On run completion, Apify calls `POST https://<your-vercel-domain>/api/ingest` with the signed webhook secret
- A first manual test run completes and events appear in the Supabase `events` table

**Todo List:**
1. Create an Apify account and locate the Facebook Events scraper Actor
2. Seed the `source_pages` table with an initial list of known Prague social dance pages (start with 5–10 well-known ones across salsa, tango, swing, bachata communities)
3. Configure the Actor input: set start URLs to the seeded source pages
4. Set the Actor schedule to run once daily
5. Add a webhook: trigger on `ACTOR_RUN_SUCCEEDED`, POST to `https://<domain>/api/ingest`, set the secret header
6. Run the Actor manually once and confirm events flow through to Supabase
7. Verify that AI classification is producing sensible tags

**Relevant Context:**
- Apify Actor used: search the Apify Store for the best-maintained Facebook Events scraper at time of setup
- The `source_pages` table from sub-task 1 drives the seed list (actor input is configured manually in Apify UI for now — automation of this can come later)

---

### 5. Events Listing Page (Frontend)

**Status:** [x] done

**Intent:**
Build the main and only page of the site: a card grid of upcoming events with a sticky filter bar for dance style. This is the entire user-facing UI.

**Expected Outcomes:**
- `/` renders all visible upcoming events from Supabase, sorted by `start_at` ascending
- A sticky filter bar at the top shows a chip/button per dance style present in the data
- Selecting a style filters the card grid client-side (no full page reload)
- Each card shows: cover image, event title, date + time, location name, dance style tag(s), and a "View on Facebook" link
- Past events are excluded (filter `start_at > now()` in the Supabase query)
- The page is mobile-first and usable on small screens
- The page uses Next.js ISR with a 1-hour revalidation period so content stays fresh without rebuilding

**Todo List:**
1. Create `app/page.tsx` — fetch events from Supabase at build/request time using ISR (`revalidate = 3600`)
2. Create `components/EventCard.tsx` — renders a single event card
3. Create `components/StyleFilter.tsx` — renders filter chips, manages selected style state, filters the card list
4. In `app/page.tsx`, derive the list of unique dance styles from the fetched events and pass to `StyleFilter`
5. Apply Tailwind styling: card grid (2 cols on mobile, 3 on desktop), sticky top filter bar, cover image with aspect ratio, readable typography
6. Add a simple empty state message if no events match the selected filter
7. Add a page `<title>` and meta description for SEO: "Dance Prague — Open social dancing events in Prague"

**Relevant Context:**
- Only `is_visible = true` events are returned (enforced by RLS in sub-task 1)
- Filter is client-side only — no URL params needed at this stage
- Cover image may be null; use a placeholder gradient or pattern in that case

---

### 6. Source Discovery Pipeline (Keyword Search)

**Status:** [ ] pending

**Intent:**
Set up a second Apify Actor run that periodically searches Facebook for new Prague dance events using keywords, and surfaces new source pages not yet in the curated list for manual review in Supabase.

**Expected Outcomes:**
- A separate Apify Actor run uses keyword search (e.g. "tanec Praha", "dancing Prague", "salsa Praha") to find events
- Results are written to a separate Supabase table `discovery_candidates` for manual review
- After review, curators promote good sources to `source_pages` directly in Supabase
- This Actor runs weekly (not daily — it's a discovery tool, not production ingestion)

**Todo List:**
1. Create a `discovery_candidates` table in Supabase:
   - `id`, `facebook_url`, `title`, `description`, `found_at`, `reviewed` (boolean, default false)
2. Create `app/api/discovery/route.ts` — similar to `/api/ingest` but writes to `discovery_candidates` instead of `events`, skipping the AI classification step
3. Configure a second Apify Actor in the Apify dashboard with keyword inputs (start with: "tanec Praha", "salsa Praha", "bachata Praha", "tango Praha", "swing Praha", "dancing Prague")
4. Set this Actor to run weekly, with its own webhook pointing to `/api/discovery`
5. Add `APIFY_DISCOVERY_WEBHOOK_SECRET` as a separate env var to distinguish the two webhooks

**Relevant Context:**
- This sub-task can be deferred until after the main site (sub-tasks 1–5) is live and working
- The `discovery_candidates` table is reviewed manually in Supabase Table Editor — no UI needed

---

## Architecture Diagram

```
Apify (daily)
  └─► POST /api/ingest
        ├─► Apify dataset fetch
        ├─► GPT-4o-mini classify
        └─► Supabase upsert (events)

Apify (weekly, keywords)
  └─► POST /api/discovery
        └─► Supabase insert (discovery_candidates)

Vercel (Next.js)
  └─► app/page.tsx (ISR, revalidate 1h)
        └─► Supabase SELECT events
              └─► EventCard + StyleFilter (client-side filter)
```
