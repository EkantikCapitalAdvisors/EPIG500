import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Edge } from '@/components/Edge';
import { Promise as PromiseSection } from '@/components/Promise';
import { HedgeProperty } from '@/components/HedgeProperty';
import { Engine } from '@/components/Engine';
import { Verification } from '@/components/Verification';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export default function Page() {
  return (
    <>
      <Header variant="on-dark" />
      <main>
        <Hero />
        <Edge />
        <PromiseSection />
        <HedgeProperty />
        <Engine />
        <Verification />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
