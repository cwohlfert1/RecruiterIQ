import Anthropic from '@anthropic-ai/sdk'

// Singleton Anthropic client — server-side only
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const MODEL = 'claude-sonnet-4-6' as const

// Word count guard — called server-side before sending to Claude
export function validateWordCount(text: string, maxWords: number): boolean {
  const count = text.trim().split(/\s+/).filter(Boolean).length
  return count <= maxWords
}
