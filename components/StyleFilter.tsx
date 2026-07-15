'use client';

import { useState } from 'react';
import { DanceEvent } from '@/types/event';
import EventCard from './EventCard';

interface Props {
  styles: string[];
  events: DanceEvent[];
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StyleFilter({ styles, events }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const filtered =
    selected === null
      ? events
      : events.filter((e) => e.dance_styles.includes(selected));

  return (
    <>
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-[#f7f8fa] border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelected(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              selected === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
            }`}
          >
            All
          </button>
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setSelected(style === selected ? null : style)}
              className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selected === style
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
            >
              {capitalize(style)}
            </button>
          ))}
        </div>
      </div>

      {/* Event grid */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            No upcoming events for this style. Check back soon!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
