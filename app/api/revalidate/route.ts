import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  if (secret !== process.env.APIFY_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  revalidatePath('/');
  return Response.json({ ok: true, revalidated: true });
}

// Also allow GET for easy manual triggering
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.APIFY_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  revalidatePath('/');
  return Response.json({ ok: true, revalidated: true });
}
