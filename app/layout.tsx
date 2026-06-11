import type { Metadata } from 'next';
import { Playfair_Display, Source_Sans_3 } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://epig500.ekantikcapital.com'),
  title: 'Ekantik 500 — Defined-Risk Long Equity with Hedge Property | Ekantik Capital',
  description:
    'A statistically validated long/flat/short S&P 500 strategy with a 0.5% loss cap per trade and a structural hedge property. Built for investors who want active equity exposure that protects — or profits — in down markets.',
  alternates: { canonical: 'https://epig500.ekantikcapital.com/' },
  openGraph: {
    type: 'website',
    url: 'https://epig500.ekantikcapital.com/',
    title: 'Ekantik 500 — Defined-Risk Long Equity with Hedge Property',
    description:
      'A statistically validated long/flat/short S&P 500 strategy with a 0.5% loss cap per trade and a structural hedge property.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ekantik 500',
    description: 'Defined-risk long equity with hedge property.',
    images: ['/og-image.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FinancialService',
  name: 'Ekantik 500',
  description:
    'Active S&P 500 strategy with defined per-trade loss cap, earned-leverage architecture, and structural hedge property.',
  provider: {
    '@type': 'FinancialService',
    name: 'Ekantik Capital Advisors LLC',
    url: 'https://epig500.ekantikcapital.com/',
  },
  url: 'https://epig500.ekantikcapital.com/',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="en" className={`${playfair.variable} ${sourceSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        {plausibleDomain ? (
          <Script
            strategy="afterInteractive"
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
      </body>
    </html>
  );
}
