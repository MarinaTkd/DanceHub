export interface DanceEvent {
  id: string;
  facebook_event_id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  location_name: string | null;
  location_address: string | null;
  cover_image_url: string | null;
  facebook_url: string;
  source: string;
  source_url: string | null;
  dance_styles: string[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}
