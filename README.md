# Ekantik Capital Advisors — EPIG 500 Website

## Project Overview
A professional investment strategy website for **Ekantik Capital Advisors LLC**, showcasing the **EPIG 500** (Enduring Principal Protection Income & Growth) managed portfolio service.

**Design:** Dark navy (#0a1628 / #071220) background with gold (#d4af37) accents, white typography — matching the Ekantik Capital Advisors brand identity.

---

## ✅ Completed Features

### index.html (Main Landing Page)
- **Revised Performance Mandate** — Updated to the new asymmetric target:
  - 📈 **Beat market by 20% in UP years** (120% of S&P 500 participation)
  - 🛡️ **~20% of market drawdown in DOWN years** (only 20% of market losses during corrections)
  - Hypothetical result: **18.1% CAGR vs 13.5% S&P 500** (2015–2026 backtested)
- **Hero Section** — Visual performance mandate display with UP/DOWN year panels + 16.1% CAGR result box
- **What Section** — Market phase statistics (70% sideways / 22% up / 8% down), EPIG formula display, $100K wealth calculator sidebar
- **How It Works** — Year-by-year comparison table (2015–2024) with Market Match / Cash Protection regimes, compounding principle steps
- **Proof Section** — Two-period historical illustrations (Lost Decade 2000-2010 & Bull Market 2015-2024), combined wealth impact box
- **Strategy Section** — Dynamic portfolio allocation display (SPY / Long-term stocks / Short-term bets / Cash)
- **5-Step Research Framework** — Evidence cards for systematic methodology
- **CTA Section** — TradingView portfolio + Skool community links
- **FAQ Section** — 6 categories with expandable answers, updated to reflect market-matching mandate
- **Disclaimer Section** — Proper risk disclosures with hypothetical backtested language
- **Footer** — Brand, links, social media

### epig-500.html (Detailed Strategy Page)
- Full detailed breakdown of EPIG 500 strategy
- Comprehensive performance comparisons
- Suitability assessment and requirements

### css/style.css
- Complete responsive CSS matching brand color scheme
- Dark navy + gold + white design language
- Mobile-first responsive breakpoints (1024px, 768px, 480px)
- CSS custom properties for consistent theming

### js/script.js
- Mobile menu toggle
- FAQ accordion functionality
- Video modal open/close
- Email subscription form handling
- Scroll-based navbar effects
- Intersection Observer animations
- Active nav link highlighting

---

## 📊 Key Performance Data Used

| Metric | Value | Period |
|--------|-------|--------|
| Hypothetical CAGR | 18.1% | 2015–2026 |
| S&P 500 CAGR | 13.5% | 2015–2026 |
| Alpha Generated | +4.6% | 120% upside, 20% drawdown |
| $100K → EPIG | $621,507 | 11 years |
| $100K → S&P | $351,162 | 11 years |
| Wealth Advantage | +$270,345 | 11 years |
| Lost Decade EPIG CAGR | 10.42% | 2000–2010 |
| Lost Decade S&P CAGR | -0.94% | 2000–2010 |
| Lost Decade Advantage | +$178,635 | 10 years |
| Bull Market EPIG CAGR | 18.40% | 2015–2024 |
| Bull Market Advantage | +$229,263 | 10 years |

---

## 🛣️ Functional Entry URIs

| Path | Description |
|------|-------------|
| `index.html` | Main landing page |
| `index.html#what` | What We Offer section |
| `index.html#how` | How It Works section |
| `index.html#proof` | Research & Proof section |
| `index.html#subscribe` | Get Started / CTA section |
| `epig-500.html` | Detailed EPIG 500 strategy page |

---

## ⚠️ Features Not Yet Implemented
- Contact form backend (currently email-only)
- Animated chart visualizations (Chart.js integration)
- Real-time S&P 500 performance ticker
- Video embed for overview section
- Blog/news section
- Downloadable strategy PDF

## 🔄 Recommended Next Steps
1. **Add Chart.js** — Interactive year-by-year performance chart comparing EPIG 500 vs S&P 500
2. **Video Section** — Replace placeholder YouTube embed with actual strategy overview video
3. **Contact Form** — Wire up email subscription to actual CRM/email service
4. **Live Performance Data** — Add real-time TradingView widget for current portfolio status
5. **SEO Optimization** — Add structured data, Open Graph tags, sitemap

---

## 📋 Brand Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Navy Deep | `#071220` | Page background |
| Navy Dark | `#0a1628` | Section backgrounds |
| Gold | `#d4af37` | Primary accent, headings |
| Gold Bright | `#f0c040` | Hover states |
| Green | `#00c896` | Positive/up indicators |
| Red | `#ff4757` | Negative/down indicators |
| White | `#ffffff` | Primary text |
