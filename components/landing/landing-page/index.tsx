import { SalesChatWidget } from '@/components/landing/sales-chat-widget'

import { CtaSection }          from './cta'
import { FeaturesSection }     from './features'
import { Footer }              from './footer'
import { HeroSection }         from './hero'
import { HowItWorksSection }   from './how-it-works'
import { Nav }                 from './nav'
import { PricingSection }      from './pricing'
import { ProblemSection }      from './problem'
import { ProofBar }            from './proof-bar'
import { TestimonialsSection } from './testimonials'

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Candid.ai',
  applicationCategory: 'BusinessApplication',
  description: 'AI recruiting platform for agency recruiters',
  url: 'https://candidai.app',
  offers: [
    { '@type': 'Offer', name: 'Free',   price: '0',   priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro',    price: '49',  priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Agency', price: '149', priceCurrency: 'USD' },
  ],
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Nav />
      <HeroSection />
      <ProofBar />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
      <SalesChatWidget />
    </div>
  )
}
