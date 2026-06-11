import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'deep-navy': '#1B2A4A',
        'warm-gold': '#C8A951',
        'clean-white': '#FFFFFF',
        'slate-gray': '#64748B',
        'soft-ivory': '#FAF8F5',
        'forest-green': '#2D5016',
        'signal-red': '#DC2626',
        'bright-teal': '#0D9488',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Playfair Display', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['var(--font-source)', 'Source Sans Pro', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
        prose: '720px',
      },
      spacing: {
        section: '96px',
        'section-mobile': '64px',
      },
      fontSize: {
        'hero': ['64px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'hero-mobile': ['40px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'section': ['40px', { lineHeight: '1.2' }],
        'section-mobile': ['28px', { lineHeight: '1.25' }],
        'sub': ['22px', { lineHeight: '1.5' }],
        'sub-mobile': ['18px', { lineHeight: '1.55' }],
        'body-lg': ['18px', { lineHeight: '1.7' }],
        'body': ['16px', { lineHeight: '1.7' }],
        'small': ['14px', { lineHeight: '1.6' }],
        'small-mobile': ['13px', { lineHeight: '1.6' }],
      },
    },
  },
  plugins: [],
};

export default config;
