import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { resume_text: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { resume_text } = body
  if (!resume_text?.trim()) {
    return NextResponse.json({ error: 'resume_text is required' }, { status: 400 })
  }

  const prompt = `Extract contact and professional details from this resume. Return ONLY valid JSON, no explanation, no markdown fences.

Resume:
${resume_text.slice(0, 5000)}

Return this exact JSON structure:
{
  "name": "full name or null",
  "email": "email address or null",
  "phone": "phone number or null",
  "current_title": "current job title or null",
  "years_experience": <integer or null>,
  "location": "city/state or null"
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    return NextResponse.json({
      name:             parsed.name            ?? null,
      email:            parsed.email           ?? null,
      phone:            parsed.phone           ?? null,
      current_title:    parsed.current_title   ?? null,
      years_experience: parsed.years_experience ?? null,
      location:         parsed.location        ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 })
  }
}
