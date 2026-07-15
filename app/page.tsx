import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { DanceEvent } from '@/types/event';
import StyleFilter from '@/components/StyleFilter';

export const revalidate = 3600;

const getEvents = unstable_cache(
  async (): Promise<DanceEvent[]> => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_visible', true)
      .gt('start_at', new Date().toISOString())
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch events:', error.message);
      return [];
    }
    return data ?? [];
  },
  ['events-listing'],
  { revalidate: 3600 }
);

export default async function HomePage() {
  const events = await getEvents();

  const styles: string[] = Array.from(
    new Set(events.flatMap((e) => e.dance_styles))
  )
    .filter((s) => s !== 'other')
    .sort()
    .concat(
      events.some((e) => e.dance_styles.includes('other')) ? ['other'] : []
    );

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dance Prague</h1>
        <p className="mt-1 text-gray-500 text-base">Open social dancing events in Prague</p>
      </div>
      <StyleFilter events={events} styles={styles} />
    </main>
  );
}
