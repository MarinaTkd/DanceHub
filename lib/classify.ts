import { getOpenAI } from './openai';

const SYSTEM_PROMPT =
  'You are a dance event classifier. Given an event title and description, return a JSON array of dance styles from this list: salsa, bachata, kizomba, tango, swing, lindy hop, zouk, west coast swing, hustle, folk, other. Return only styles that clearly apply. If the event is a class or lesson rather than a social dance, return ["lesson"]. If unclear, return ["other"]. Return ONLY the JSON array, no other text.';

export async function classifyDanceStyles(
  title: string,
  description: string
): Promise<string[]> {
  const userMessage = `${title}\n${description.slice(0, 500)}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? '["other"]';
    return JSON.parse(content) as string[];
  } catch {
    return ['other'];
  }
}
