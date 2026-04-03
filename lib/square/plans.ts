/**
 * Square subscription plan IDs.
 *
 * Run the setup script once to create plans in Square and capture the IDs:
 *   npx tsx lib/square/setup-plans.ts
 *
 * Then add the output IDs to your Railway environment variables:
 *   SQUARE_PRO_PLAN_ID
 *   SQUARE_PRO_PLAN_VARIATION_ID
 *   SQUARE_AGENCY_PLAN_ID
 *   SQUARE_AGENCY_PLAN_VARIATION_ID
 */

export const PLAN_CONFIG = {
  pro: {
    name: 'Pro',
    priceInCents: 4900,
    displayPrice: '$49',
    cadence: 'MONTHLY' as const,
    planId: process.env.SQUARE_PRO_PLAN_ID ?? '',
    planVariationId: process.env.SQUARE_PRO_PLAN_VARIATION_ID ?? '',
    features: [
      'Unlimited Screenings',
      'Resume Scorer',
      'Client Summary Generator',
      'Boolean String Generator',
    ],
  },
  agency: {
    name: 'Agency',
    priceInCents: 14900,
    displayPrice: '$149',
    cadence: 'MONTHLY' as const,
    planId: process.env.SQUARE_AGENCY_PLAN_ID ?? '',
    planVariationId: process.env.SQUARE_AGENCY_PLAN_VARIATION_ID ?? '',
    features: [
      'Everything in Pro',
      'Stack Ranking',
      'Team management (5 seats)',
      'CSV export',
    ],
  },
} as const

export type PaidPlanKey = keyof typeof PLAN_CONFIG
