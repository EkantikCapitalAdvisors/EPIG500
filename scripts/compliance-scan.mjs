#!/usr/bin/env node
// v1.3 §6.4 compliance scan. Runs against the rendered HTML in ./out (post-build),
// because source-code distance between a value and its qualifier isn't a meaningful
// proxy for visual reader context. Run AFTER `next build`.
//
// Run: `npm run build && npm run compliance:scan`
// CI wires both into .github/workflows/deploy.yml.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'out');

if (!fs.existsSync(OUT_DIR)) {
  console.error('Compliance scan: ./out does not exist. Run `next build` first.');
  process.exit(2);
}

// Hard-forbidden phrases (§6.3, §6.4). Matches case-insensitively in rendered text.
// To allow a phrase inside an explicit negation (e.g. "not guaranteed in future"),
// the pattern uses a negative lookahead.
const FORBIDDEN = [
  {
    pattern: /\bguaranteed?\b/i,
    why: '"guaranteed" appears in user-visible copy.',
    allowIfNear: /\b(not|never|no)\s+(guaranteed?|guarantee)/i,
  },
  {
    pattern: /principal protection/i,
    why: '§6.3 forbids "principal protection" in product naming/labeling.',
    allowIfNear: /\b(loss of principal|risk of loss of principal)\b/i,
  },
  {
    pattern: /you\s+will\s+earn/i,
    why: 'Forward-looking return promise — forbidden by §6.4.',
  },
  {
    pattern: /risk[-\s]?free\b/i,
    why: '"Risk-free" framing forbidden by §6.4.',
  },
  {
    pattern: /always\s+negatively\s+correlated/i,
    why: 'Hedge-property language must use "designed to" / "observed".',
  },
  {
    pattern: /expected\s+annual\s+returns?\s+of/i,
    why: 'Forward-looking return promise — forbidden by §6.4.',
  },
];

// Numeric performance references should travel with a qualifier in immediate context.
// Match "16%", "+24%", "+10%", "10%", "CAGR" etc. — but exclude small fractional artifacts (".5%").
const NUMERIC_RE = /(?:^|[^\d.])([+-]?\d{1,2}(?:\.\d+)?%|CAGR|\bcalendar year\b)/gi;
// Acceptable qualifiers within ±260 characters of plain text.
const QUALIFIER_RE = /(backtested|backtest|live deployment|live\/current|live indicator|forward[-\s]?looking|architectural|out[-\s]?of[-\s]?sample|past results|hard[-\s]?stop|catastrophic stop)/i;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ');
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let errors = 0;
const files = walk(OUT_DIR);

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const text = stripHtml(html);
  // Skip the legal Footer disclaimer block as a whole — those legitimately mention
  // "guaranteed" inside negations, "principal" inside risk-of-loss language, etc.
  // We still scan the rest of the page.
  // Identify by marker phrases that are stable across pages.
  const footerIdx = text.indexOf('Ekantik Capital Advisors LLC is a registered investment advisor');
  const scope = footerIdx > 0 ? text.slice(0, footerIdx) : text;

  // Forbidden tokens
  for (const rule of FORBIDDEN) {
    let m;
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    while ((m = re.exec(scope)) !== null) {
      const idx = m.index;
      const ctx = scope.slice(Math.max(0, idx - 60), Math.min(scope.length, idx + m[0].length + 60));
      if (rule.allowIfNear && rule.allowIfNear.test(ctx)) continue;
      console.error(`\n  [forbidden] ${path.relative(ROOT, file)}\n    match: "${m[0]}"\n    ctx:   …${ctx}…\n    why:   ${rule.why}`);
      errors++;
    }
  }

  // Numeric qualifier discipline
  let m;
  const seen = new Set();
  while ((m = NUMERIC_RE.exec(scope)) !== null) {
    const tok = m[1];
    const idx = m.index + m[0].indexOf(tok);
    // De-duplicate identical "16%" hits within ~30 chars of each other.
    const key = `${tok}@${Math.floor(idx / 30)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lo = Math.max(0, idx - 260);
    const hi = Math.min(scope.length, idx + tok.length + 260);
    const window = scope.slice(lo, hi);
    if (!QUALIFIER_RE.test(window)) {
      const ctx = scope.slice(Math.max(0, idx - 80), Math.min(scope.length, idx + tok.length + 80));
      console.error(
        `\n  [discipline] ${path.relative(ROOT, file)}\n    token: "${tok}"\n    ctx:   …${ctx}…\n    why:   §6.4 — numeric reference lacks qualifier (backtested/live/forward-looking/architectural/etc.) within ±260 chars of rendered text.`,
      );
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\nCompliance scan failed: ${errors} issue(s).`);
  process.exit(1);
}
console.log(`Compliance scan passed across ${files.length} HTML file(s).`);
