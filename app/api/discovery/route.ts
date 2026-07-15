import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface ApifyItem {
  url?: string;
  link?: string;
  name?: string;
  title?: string;
  description?: string;
  error?: string;
  isPast?: boolean;
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

    // 3. Fetch items from Apify dataset
    const apifyUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${process.env.APIFY_API_TOKEN}&format=json`;
    const datasetRes = await fetch(apifyUrl);
    if (!datasetRes.ok) {
      throw new Error(`Apify dataset fetch failed: ${datasetRes.status}`);
    }
    const allItems = (await datasetRes.json()) as ApifyItem[];

    // 4. Filter out error items and past events
    const items = allItems.filter((item) => !item.error && !item.isPast);

    // 5. Upsert each candidate into discovery_candidates
    let processed = 0;
    for (const item of items) {
      const facebook_url = item.url ?? item.link ?? '';
      if (!facebook_url) continue;

      const record = {
        facebook_url,
        title: item.name ?? item.title ?? null,
        description: item.description ?? null,
      };

      const { error } = await getSupabaseAdmin()
        .from('discovery_candidates')
        .upsert(record, {
          onConflict: 'facebook_url',
          ignoreDuplicates: false,
        })
        .select('facebook_url, title, description');

      if (error) throw new Error(error.message);
      processed++;
    }

    return Response.json({ ok: true, processed }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
