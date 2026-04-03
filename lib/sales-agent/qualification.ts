import { anthropic, MODEL } from '@/lib/anthropic'

export interface ExtractedLeadInfo {
  name: string | null
  email: string | null
  company: string | null
  team_size: string | null
}

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Extracts name, email, company, and team_size from the full conversation.
 * Uses a lightweight Claude call after each turn — runs server-side only.
 */
export async function extractLeadInfo(
  conversation: MessageParam[],
): Promise<ExtractedLeadInfo> {
  if (conversation.length === 0) {
    return { name: null, email: null, company: null, team_size: null }
  }

  const transcript = conversation
    .map((m) => `${m.role === 'user' ? 'Prospect' : 'Aria'}: ${m.content}`)
    .join('\n')

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Extract contact information from this sales chat transcript. Return ONLY valid JSON with exactly these fields. Set any unknown field to null.

{"name": string | null, "email": string | null, "company": string | null, "team_size": string | null}

Rules:
- name: the prospect's first name or full name, only if clearly stated
- email: a valid email address, only if explicitly provided
- company: the company or agency name, only if explicitly stated
- team_size: number of recruiters or team members, as a string (e.g., "5", "10-20", "about 8")
- Return null for any field that was not mentioned or is ambiguous

Transcript:
${transcript.slice(0, 4000)}`,
        },
      ],
    })

    const raw =
      response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { name: null, email: null, company: null, team_size: null }

    const parsed = JSON.parse(match[0])
    return {
      name: typeof parsed.name === 'string' ? parsed.name : null,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      company: typeof parsed.company === 'string' ? parsed.company : null,
      team_size: typeof parsed.team_size === 'string' ? parsed.team_size : null,
    }
  } catch {
    return { name: null, email: null, company: null, team_size: null }
  }
}

export function isQualified(info: ExtractedLeadInfo): boolean {
  return !!(info.name && info.email && info.company)
}
