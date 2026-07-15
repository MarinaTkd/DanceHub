import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { classifyDanceStyles } from '@/lib/classify';

interface ApifyItem {
  id?: string;
  eventId?: string;
  name?: string;
  title?: string;
  description?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  location?: { name?: string; address?: string };
  venueName?: string;
  venueAddress?: string;
  photo?: { imageUri?: string };
  coverPhoto?: { url?: string };
  url?: string;
  link?: string;
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
    const items = (await datasetRes.json()) as ApifyItem[];

    // 4–7. Process in batches of 10
    let processed = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
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
            start_at: item.startTime ?? item.start_time ?? '',
            end_at: item.endTime ?? item.end_time ?? null,
            location_name: item.location?.name ?? item.venueName ?? null,
            location_address:
              item.location?.address ?? item.venueAddress ?? null,
            cover_image_url:
              item.photo?.imageUri ?? item.coverPhoto?.url ?? null,
            facebook_url: item.url ?? item.link ?? '',
            dance_styles,
            is_visible,
          };

          // 7. Upsert into Supabase
          const { error } = await supabase
            .from('events')
            .upsert(record, { onConflict: 'facebook_event_id' });

          if (error) throw new Error(error.message);
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      processed += succeeded;
    }

    // 8. Return success
    return Response.json({ ok: true, processed }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 9. Return error
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
