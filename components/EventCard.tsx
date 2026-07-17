import { DanceEvent } from '@/types/event';

interface Props {
  event: DanceEvent;
}

const STYLE_COLORS: Record<string, string> = {
  salsa:            'bg-rose-100 text-rose-700',
  bachata:          'bg-orange-100 text-orange-700',
  tango:            'bg-red-100 text-red-700',
  swing:            'bg-yellow-100 text-yellow-700',
  'lindy hop':      'bg-amber-100 text-amber-700',
  kizomba:          'bg-purple-100 text-purple-700',
  zouk:             'bg-pink-100 text-pink-700',
  'west coast swing': 'bg-sky-100 text-sky-700',
  hustle:           'bg-teal-100 text-teal-700',
  folk:             'bg-green-100 text-green-700',
  other:            'bg-gray-100 text-gray-600',
};

const GRADIENT_MAP: Record<string, string> = {
  salsa:            'from-rose-400 to-red-500',
  bachata:          'from-orange-400 to-amber-500',
  tango:            'from-red-500 to-rose-700',
  swing:            'from-yellow-400 to-orange-400',
  'lindy hop':      'from-amber-400 to-yellow-500',
  kizomba:          'from-purple-500 to-violet-600',
  zouk:             'from-pink-400 to-rose-500',
  'west coast swing': 'from-sky-400 to-blue-500',
  hustle:           'from-teal-400 to-cyan-500',
  folk:             'from-green-400 to-emerald-500',
};

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) + ' · ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function EventCard({ event }: Props) {
  const firstStyle = event.dance_styles[0] ?? 'other';
  const gradient = GRADIENT_MAP[firstStyle] ?? 'from-indigo-400 to-purple-500';

  return (
    <article className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
      {/* Cover image */}
      {event.cover_image_url ? (
        <div className="aspect-video w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className={`aspect-video w-full bg-gradient-to-br ${gradient}`} aria-hidden="true" />
      )}

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Style chips */}
        {event.dance_styles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.dance_styles.map((style) => (
              <span
                key={style}
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${STYLE_COLORS[style] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {capitalize(style)}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h2 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">
          {event.title}
        </h2>

        {/* Date */}
        <p className="text-sm text-gray-500">{formatDate(event.start_at)}</p>

        {/* Location */}
        {event.location_name && (
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="truncate">{event.location_name}</span>
          </p>
        )}

        {/* Spacer + link + source badge */}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <a
            href={event.facebook_url ?? event.source_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {event.source === 'web' ? 'View event →' : 'View on Facebook →'}
          </a>
          <span className="text-xs text-gray-400 shrink-0">
            {event.source === 'web' ? '🌐 Web' : '📘 Facebook'}
          </span>
        </div>
      </div>
    </article>
  );
}
