alter table public.events
  add column if not exists source text not null default 'facebook',
  add column if not exists source_url text;

-- Allow web events that have no facebook_event_id or facebook_url
alter table public.events
  alter column facebook_event_id drop not null,
  alter column facebook_url drop not null;

-- Unique constraint (required for ON CONFLICT upsert)
alter table public.events
  add constraint if not exists events_source_url_key unique (source_url);

-- Partial index for efficient lookups
create unique index if not exists events_source_url_unique
  on public.events (source_url)
  where source_url is not null;
