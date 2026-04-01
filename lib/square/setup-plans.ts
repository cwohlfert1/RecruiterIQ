/**
 * One-time setup script — creates Pro and Agency subscription plans in Square.
 *
 * Run once per environment (sandbox + production separately):
 *   npx tsx lib/square/setup-plans.ts
 *
 * Copy the output IDs into your environment variables:
 *   SQUARE_PRO_PLAN_ID
 *   SQUARE_PRO_PLAN_VARIATION_ID
 *   SQUARE_AGENCY_PLAN_ID
 *   SQUARE_AGENCY_PLAN_VARIATION_ID
 *
 * Re-running is safe — upsertCatalogObject with the same idempotency key
 * returns the existing object rather than creating a duplicate.
 */

import 'dotenv/config'
import { squareClient } from './client'

async function createPlan(
  idempotencyKey: string,
  name: string,
  priceInCents: number
) {
  const response = await squareClient.catalog.object.upsert({
    idempotencyKey,
    object: {
      type: 'SUBSCRIPTION_PLAN',
      id: `#${idempotencyKey}`,
      subscriptionPlanData: {
        name,
        phases: [
          {
            cadence: 'MONTHLY',
            ordinal: BigInt(0),
            pricing: {
              type: 'STATIC',
              priceMoney: {
                amount: BigInt(priceInCents),
                currency: 'USD',
              },
            },
          },
        ],
      },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = response.catalogObject as any
  if (!obj?.id) throw new Error(`Failed to create plan: ${name}`)

  const planId = obj.id as string
  // The variation ID is the phase ID — used as planVariationId when creating subscriptions
  const planVariationId: string = obj.subscriptionPlanData?.phases?.[0]?.uid ?? ''

  return { planId, planVariationId }
}

async function main() {
  console.log('Creating Square subscription plans...\n')

  const pro = await createPlan(
    'recruiteriq-pro-plan-v1',
    'Candid.ai Pro',
    3900
  )
  console.log('✓ Pro plan created:')
  console.log(`  SQUARE_PRO_PLAN_ID=${pro.planId}`)
  console.log(`  SQUARE_PRO_PLAN_VARIATION_ID=${pro.planVariationId}\n`)

  const agency = await createPlan(
    'recruiteriq-agency-plan-v1',
    'Candid.ai Agency',
    9900
  )
  console.log('✓ Agency plan created:')
  console.log(`  SQUARE_AGENCY_PLAN_ID=${agency.planId}`)
  console.log(`  SQUARE_AGENCY_PLAN_VARIATION_ID=${agency.planVariationId}\n`)

  console.log('Add all four env vars to Railway and your .env.local, then redeploy.')
}

main().catch((err) => {
  console.error('Setup failed:', err)
  process.exit(1)
})
