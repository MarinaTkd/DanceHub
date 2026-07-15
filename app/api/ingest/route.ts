import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';
import { classifyDanceStyles } from '@/lib/classify';

interface ApifyItem {
  id?: string;
  eventId?: string;
  name?: string;
  title?: string;
  description?: string;
  utcStartDate?: string;
  startTime?: string;
  start_time?: string;
  utcEndDate?: string;
  endTime?: string;
  end_time?: string;
  location?: { name?: string; streetAddress?: string; address?: string };
  venueName?: string;
  venueAddress?: string;
  imageUrl?: string;
  photo?: { imageUri?: string };
  coverPhoto?: { url?: string };
  url?: string;
  link?: string;
  error?: string;
  isPast?: boolean;
}

const BATCH_SIZE = 10;

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

    // 3. Fetch items from Apify dataset
    const apifyUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${process.env.APIFY_API_TOKEN}&format=json`;
    const datasetRes = await fetch(apifyUrl);
    if (!datasetRes.ok) {
      throw new Error(`Apify dataset fetch failed: ${datasetRes.status}`);
    }
    const allItems = (await datasetRes.json()) as ApifyItem[];
    // Filter out past events and error items before processing
    const items = allItems.filter(
      (item) => !item.error && !item.isPast
    );

    // 4–7. Process in batches of 10
    let processed = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          // Skip error items returned by the scraper
          if (item.error) return;

          const title = item.name ?? item.title ?? '';
          const description = item.description ?? '';

          // 5. Classify dance styles
          const dance_styles = await classifyDanceStyles(title, description);

          // 6. Determine visibility
          const is_visible =
            !dance_styles.includes('lesson') &&
            !dance_styles.includes('other');

          // 4. Map fields
          const record = {
            facebook_event_id: item.id ?? item.eventId ?? '',
            title,
            description,
            start_at: item.utcStartDate ?? item.startTime ?? item.start_time ?? '',
            end_at: item.utcEndDate ?? item.endTime ?? item.end_time ?? null,
            location_name: item.location?.name ?? item.venueName ?? null,
            location_address:
              item.location?.streetAddress ?? item.location?.address ?? item.venueAddress ?? null,
            cover_image_url:
              item.imageUrl ?? item.photo?.imageUri ?? item.coverPhoto?.url ?? null,
            facebook_url: item.url ?? item.link ?? '',
            dance_styles,
            is_visible,
          };

          // 7. Upsert into Supabase
          const { error } = await getSupabaseAdmin()
            .from('events')
            .upsert(record, { onConflict: 'facebook_event_id' });

          if (error) throw new Error(error.message);
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      processed += succeeded;
    }

    // 8. Revalidate the homepage cache
    revalidatePath('/');

    // 9. Return success
    return Response.json({ ok: true, processed }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 9. Return error
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
