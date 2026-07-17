import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';
import { extractWebEvents } from '@/lib/extract-web-events';

interface OrganicResult {
  url?: string;
  title?: string;
  description?: string;  // Google snippet — already clean text
}

interface ApifySearchItem {
  url?: string;
  error?: boolean;
  '#error'?: boolean;
  organicResults?: OrganicResult[];
  searchQuery?: { term?: string };
}

const BATCH_SIZE = 5;

/** Strip HTML to plain text: remove script/style/nav/header/footer blocks, strip tags, collapse whitespace */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const secret = request.headers.get('x-apify-webhook-secret');
  if (!secret || secret !== process.env.APIFY_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Parse body
    const body = await request.json() as {
      resource?: { defaultDatasetId?: string };
    };
    const defaultDatasetId = body?.resource?.defaultDatasetId;
    if (!defaultDatasetId) {
      return Response.json(
        { ok: false, error: 'Missing defaultDatasetId' },
        { status: 400 }
      );
    }

    // 3. Fetch dataset items from Apify
    const apifyUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${process.env.APIFY_API_TOKEN}&format=json`;
    const datasetRes = await fetch(apifyUrl);
    if (!datasetRes.ok) {
      throw new Error(`Apify dataset fetch failed: ${datasetRes.status}`);
    }
    const allItems = (await datasetRes.json()) as ApifySearchItem[];

    // 4. Filter out error items
    const validItems = allItems.filter((item) => !item.error && !item['#error']);

    // 5. Collect organic results with their snippets — skip Facebook/Instagram (covered by FB pipeline)
    interface ResultWithContext { url: string; title: string; snippet: string; }
    const resultMap = new Map<string, ResultWithContext>();
    for (const item of validItems) {
      for (const r of item.organicResults ?? []) {
        if (!r.url) continue;
        if (r.url.includes('facebook.com') || r.url.includes('instagram.com')) continue;
        if (!resultMap.has(r.url)) {
          resultMap.set(r.url, {
            url: r.url,
            title: r.title ?? '',
            snippet: r.description ?? '',
          });
        }
      }
    }
    const results_list = Array.from(resultMap.values());

    let pagesScraped = 0;
    let processed = 0;

    // 9. Process in batches — use snippet + try page fetch, fall back to snippet only
    for (let i = 0; i < results_list.length; i += BATCH_SIZE) {
      const batch = results_list.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async ({ url, title, snippet }) => {
          // Try fetching the page for richer content; fall back to snippet on failure
          let pageText = `${title}\n${snippet}`;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8_000);
            const pageRes = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (pageRes.ok) {
              const html = await pageRes.text();
              const stripped = htmlToText(html).slice(0, 6000);
              // Only use page text if it has meaningful content (>200 chars)
              if (stripped.length > 200) pageText = stripped;
            }
          } catch {
            // timeout or network error — use snippet fallback
          }
          pagesScraped++;

          // 7. Extract events with GPT
          const events = await extractWebEvents(pageText, url);

          // 8. Upsert each event into Supabase
          for (const event of events) {
            const { error } = await getSupabaseAdmin()
              .from('events')
              .upsert(event, { onConflict: 'source_url' });
            if (error) throw new Error(error.message);
            processed++;
          }
        })
      );

      // Surface any batch errors to logs (do not abort overall run)
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[web-ingest] batch item error:', result.reason);
        }
      }
    }

    // 10. Revalidate homepage cache
    revalidatePath('/');

    // 11. Return summary
    return Response.json({ ok: true, pagesScraped, processed }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
