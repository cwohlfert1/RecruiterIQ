import { SquareClient, SquareEnvironment } from 'square'

/**
 * Singleton Square SDK client.
 * All Square API calls must happen server-side only — never import in client components.
 */
export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
})
