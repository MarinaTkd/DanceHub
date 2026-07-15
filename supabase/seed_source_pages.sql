-- Seed: known Prague social dance Facebook pages/groups
-- Run this in the Supabase SQL Editor after schema.sql

INSERT INTO source_pages (facebook_url, label, dance_style_hint, is_active) VALUES
  ('https://www.facebook.com/salsaprague', 'Salsa Prague', 'salsa', true),
  ('https://www.facebook.com/groups/salsaprague', 'Salsa Prague Group', 'salsa', true),
  ('https://www.facebook.com/BachataRepublicPrague', 'Bachata Republic Prague', 'bachata', true),
  ('https://www.facebook.com/groups/bachataczech', 'Bachata Czech Group', 'bachata', true),
  ('https://www.facebook.com/TangoPraha', 'Tango Praha', 'tango', true),
  ('https://www.facebook.com/groups/tangoPraha', 'Tango Praha Group', 'tango', true),
  ('https://www.facebook.com/SwingDancePrague', 'Swing Dance Prague', 'swing', true),
  ('https://www.facebook.com/groups/swingprague', 'Swing Prague Group', 'swing', true),
  ('https://www.facebook.com/KizombaPrague', 'Kizomba Prague', 'kizomba', true),
  ('https://www.facebook.com/groups/zoukprague', 'Zouk Prague Group', 'zouk', true)
ON CONFLICT (facebook_url) DO NOTHING;
