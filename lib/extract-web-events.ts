import { getOpenAI } from './openai';

export interface WebEvent {
  title: string;
  description: string;
  start_at: string;           // ISO 8601
  end_at: string | null;      // ISO 8601 or null
  location_name: string | null;
  cover_image_url: null;      // always null for web events
  facebook_url: null;         // always null for web events
  source_url: string;         // the page URL
  source: 'web';
  dance_styles: string[];     // classified by same prompt
  is_visible: boolean;        // false if lesson, true otherwise
}

const SYSTEM_PROMPT =
  'You are a dance event extractor. Given the text content of a webpage and its URL, extract all upcoming social dance events (not lessons, not workshops, not courses). \n\nFor each event return a JSON object with these fields:\n- title: string\n- description: string (max 300 chars)\n- start_at: ISO 8601 datetime string (if only date known, use T00:00:00Z)\n- end_at: ISO 8601 datetime string or null\n- location_name: string or null\n- dance_styles: array of styles from: salsa, bachata, kizomba, tango, swing, lindy hop, zouk, west coast swing, hustle, folk, other\n- is_visible: true (false only if you determine this is actually a lesson/course despite appearing on the page)\n\nReturn ONLY a JSON array of event objects. If no events found, return []. Do not include past events. Current date context is provided in the user message.';

interface RawEvent {
  title?: unknown;
  description?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  location_name?: unknown;
  dance_styles?: unknown;
  is_visible?: unknown;
}

export async function extractWebEvents(
  pageText: string,
  pageUrl: string
): Promise<WebEvent[]> {
  const currentDate = new Date().toISOString().slice(0, 10);
  const truncatedText = pageText.slice(0, 6000);

  const userMessage = `Current date: ${currentDate}\nPage URL: ${pageUrl}\nPage content:\n${truncatedText}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? '[]';
    let parsed: RawEvent[];
    try {
      parsed = JSON.parse(content) as RawEvent[];
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => ({
      title: String(item.title ?? ''),
      description: String(item.description ?? ''),
      start_at: String(item.start_at ?? ''),
      end_at: item.end_at != null ? String(item.end_at) : null,
      location_name: item.location_name != null ? String(item.location_name) : null,
      cover_image_url: null,
      facebook_url: null,
      source_url: pageUrl,
      source: 'web',
      dance_styles: Array.isArray(item.dance_styles)
        ? (item.dance_styles as unknown[]).map(String)
        : [],
      is_visible: item.is_visible !== false,
    }));
  } catch {
    return [];
  }
}
