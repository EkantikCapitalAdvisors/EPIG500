/* ================================================
   EKANTIK 500 — Admin Interface
   Trade upload + dataset management. No gate — admin actions only persist
   when the operator downloads the new trades.json and commits it.
   ================================================ */
(function () {
    'use strict';

    let CURRENT = { meta: {}, trades: [] };
    let STAGED = [];

    // Load the current dataset on page open
    loadCurrent();

    /* ---------- Load current dataset ---------- */
    function loadCurrent() {
        fetch('data/trades.json', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                CURRENT = { meta: json.meta || {}, trades: (json.trades || []).slice() };
                renderMeta();
                renderKpis();
                renderCurrent();
            })
            .catch(function (e) {
                document.getElementById('adminMeta').textContent = 'Could not load data/trades.json: ' + e.message;
            });
    }

    function renderMeta() {
        const updated = CURRENT.meta.last_updated ? new Date(CURRENT.meta.last_updated).toLocaleString() : '—';
        document.getElementById('adminMeta').innerHTML =
            'Current dataset: <strong>' + CURRENT.trades.length + '</strong> trades · last updated ' + updated;
        document.getElementById('adminCurrentCount').textContent = CURRENT.trades.length + ' trades';
    }

    function renderKpis() {
        const trades = CURRENT.trades;
        if (!trades.length) { document.getElementById('adminKpis').innerHTML = ''; return; }
        // Points-based KPI strip is the ES-equivalent engine record — only count
        // trades that carry numeric ES-equiv points (excludes IB stock/option /
        // non-ES booster trades, whose P&L is dollar-denominated, and SPY).
        const pts = trades.map(function (t) { return t.pts; }).filter(function (x) { return typeof x === 'number'; });
        const wins = pts.filter(function (x) { return x > 0; });
        const losses = pts.filter(function (x) { return x < 0; });
        const be = pts.filter(function (x) { return x === 0; });
        const wr = wins.length / Math.max(1, pts.length - be.length);
        const gw = wins.reduce(function (a, b) { return a + b; }, 0);
        const gl = Math.abs(losses.reduce(function (a, b) { return a + b; }, 0));
        const pf = gl > 0 ? gw / gl : Infinity;
        const total = pts.reduce(function (a, b) { return a + b; }, 0);

        const k = document.getElementById('adminKpis');
        const kpis = [
            { label: 'Total trades', val: String(pts.length), sub: wins.length + ' W · ' + losses.length + ' L · ' + be.length + ' BE' },
            { label: 'Win rate', val: (wr*100).toFixed(1)+'%', sub: 'excl. BE' },
            { label: 'Profit Factor', val: isFinite(pf)?pf.toFixed(2):'∞', sub: '', mood: pf>=1.5?'pos':'neg' },
            { label: 'Total P&L', val: (total>=0?'+':'')+total.toFixed(0)+' pts', sub: '$'+Math.round(total*50).toLocaleString()+'/ctr', mood: total>=0?'pos':'neg' },
            { label: 'Staged', val: String(STAGED.length), sub: 'awaiting merge' },
            { label: 'Pending output', val: (CURRENT.trades.length + STAGED.length).toString(), sub: 'after merge' }
        ];
        k.innerHTML = kpis.map(function (x) {
            const moodClass = x.mood ? ' kpi--' + x.mood : '';
            return '<div class="kpi'+moodClass+'"><p class="kpi__label">'+x.label+'</p><p class="kpi__value">'+x.val+'</p><p class="kpi__sub">'+x.sub+'</p></div>';
        }).join('');
    }

    /* ---------- Strategy toggle ---------- */
    function currentStrategy() {
        const r = document.querySelector('input[name="strategy"]:checked');
        return r ? r.value : 'futures';
    }
    function defaultSymbol() { return currentStrategy() === 'options' ? 'SPX' : '/ES'; }

    /* ---------- Default size (operator preference) ----------
       Used ONLY when the Discord trade line has no explicit size token. Persisted
       per-device in localStorage. Belt-and-braces fix for the recurring
       "2 MES → 1 ES" silent fallback (see PRs #105 #107 for the three operator
       corrections this caused).

       Codes match the <select> options in admin.html:
         '1ES' '1MES' '2MES' '3MES' '5MES' '10MES'
    */
    const DEFAULT_SIZE_KEY = 'epig500_admin_default_size_v1';
    function readDefaultSizeCode() {
        try { return localStorage.getItem(DEFAULT_SIZE_KEY) || '1ES'; } catch (e) { return '1ES'; }
    }
    function writeDefaultSizeCode(code) {
        try { localStorage.setItem(DEFAULT_SIZE_KEY, code); } catch (e) {}
    }
    // Resolve a size code into the same shape resolveSize() returns from a regex match.
    function resolveDefaultSize() {
        const code = readDefaultSizeCode();
        const m = code.match(/^(\d+)(ES|MES)$/);
        const qty = m ? parseInt(m[1], 10) : 1;
        const inst = m ? m[2] : 'ES';
        const isMicro = inst === 'MES';
        return {
            qty: qty,
            instrument: inst,
            esEquiv: isMicro ? qty / 10 : qty,
            dollarPerPoint: isMicro ? 5 : 50,
            _fromFallback: true   // tagged so renderPreview() can warn
        };
    }
    // Wire the <select> on page load (idempotent if the element isn't present).
    (function initDefaultSizeSelect() {
        const sel = document.getElementById('adminDefaultSize');
        if (!sel) return;
        sel.value = readDefaultSizeCode();
        sel.addEventListener('change', function () { writeDefaultSizeCode(sel.value); });
    })();

    /* ---------- Status ---------- */
    function status(msg, level) {
        const el = document.getElementById('adminStatus');
        el.hidden = false;
        el.className = 'admin-status is-' + (level || 'info');
        el.textContent = msg;
    }

    /* ---------- CSV / JSON parsing ---------- */
    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length; });
        if (lines.length < 2) return null;
        function split(line) {
            const out = []; let cur = ''; let q = false;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === '"') q = !q;
                else if (c === ',' && !q) { out.push(cur); cur = ''; }
                else cur += c;
            }
            out.push(cur);
            return out.map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
        }
        const header = split(lines[0]).map(function (h) { return h.toLowerCase().replace(/\s+/g, '_'); });
        return lines.slice(1).map(function (l) {
            const cells = split(l);
            const obj = {};
            header.forEach(function (h, i) { obj[h] = cells[i]; });
            return obj;
        });
    }

    function rowsToTrades(rows, nextId) {
        if (!Array.isArray(rows) || !rows.length) return [];
        const sample = rows[0];
        const keys = Object.keys(sample);
        function pick(cands) { return cands.find(function (k) { return keys.indexOf(k) !== -1; }); }

        const idKey   = pick(['id','trade_id','#']);
        const tsKey   = pick(['timestamp','time','date','datetime','exit_time','close_time']);
        const symKey  = pick(['symbol','contract','instrument']);
        const sideKey = pick(['side','direction']);
        const ptsKey  = pick(['pts','points','pl_points','points_pnl','pnl_pts']);
        const pnlKey  = pick(['pnl','p/l','profit_loss','realized_pnl','net_pnl','pl','profit','net','dollars']);
        const tagKey  = pick(['tag','attribution','category','reason']);
        const resKey  = pick(['result','outcome','wl']);

        const out = [];
        let id = nextId;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            let pts = null;
            if (ptsKey && r[ptsKey] != null && r[ptsKey] !== '') {
                pts = parseFloat(String(r[ptsKey]).replace(/[$,()]/g, ''));
                if (String(r[ptsKey]).indexOf('(') === 0) pts = -Math.abs(pts);
            } else if (pnlKey && r[pnlKey] != null && r[pnlKey] !== '') {
                const dollars = parseFloat(String(r[pnlKey]).replace(/[$,()]/g, ''));
                pts = (String(r[pnlKey]).indexOf('(') === 0 ? -Math.abs(dollars) : dollars) / 50;
            }
            if (pts == null || isNaN(pts)) continue;
            const tsRaw = tsKey ? r[tsKey] : null;
            let ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();
            if (isNaN(new Date(ts).getTime())) ts = new Date().toISOString();
            const result = resKey && r[resKey] ? String(r[resKey]).toUpperCase().charAt(0)
                : (pts > 0 ? 'W' : pts < 0 ? 'L' : 'BE');
            out.push({
                id: idKey && r[idKey] ? r[idKey] : (id++),
                timestamp: ts,
                symbol: symKey ? (r[symKey] || '/ES') : '/ES',
                side: sideKey ? String(r[sideKey] || '').toUpperCase() : '',
                result: result,
                pts: Math.round(pts * 100) / 100,
                dollars: Math.round(pts * 50 * 100) / 100,
                tag: tagKey && r[tagKey] ? String(r[tagKey]).toUpperCase() : (pts === 0 ? 'BE' : 'H3'),
                period: 'pre_reg'
            });
        }
        return out;
    }

    /* ---------- Interactive Brokers — Flex Query (Trades) CSV ----------
       Imports IB Activity Flex Query "Trades" CSV. Produces ROUND-TRIPS
       (one row per completed trade), not raw fills.

       Book routing (per product spec):
         - SPY stock OR options whose underlying is SPY  →  'synthetic_passive'
         - everything else (ES/MES futures, other options/stocks, SPX, NQ…)
                                                          →  'engine' (Booster)

       P&L:
         - Primary: one trade per CLOSING execution, using the row's
           FifoPnlRealized (IB's own realized number).
         - Fallback (no FifoPnlRealized column): FIFO-pair raw executions
           per instrument and compute realized P&L from price deltas.

       pts (ES-equivalent points) is set ONLY for ES / MES futures
       (= realized$ / 50). For every other asset class pts is null and the
       dollar P&L is authoritative — the points-denominated dashboard /
       live-vs-kill chart filter to numeric pts so they stay ES-clean. */
    function looksLikeIbFlex(rows) {
        if (!Array.isArray(rows) || !rows.length) return false;
        const k = Object.keys(rows[0]);
        const has = function (n) { return k.indexOf(n) !== -1; };
        return has('assetclass')
            && (has('buy/sell') || has('buysell'))
            && (has('fifopnlrealized') || has('open/closeindicator') || has('openclose') || has('tradeid') || has('underlyingsymbol'));
    }

    function ibNum(v) {
        if (v == null || v === '') return null;
        const neg = String(v).indexOf('(') === 0;
        const n = parseFloat(String(v).replace(/[$,()\s]/g, ''));
        if (isNaN(n)) return null;
        return neg ? -Math.abs(n) : n;
    }

    function ibDateTime(dateStr, timeStr) {
        if (!dateStr && !timeStr) return null;
        let s = (dateStr || '').trim();
        let t = (timeStr || '').trim();
        if (!t && /[;,]/.test(s)) {
            const parts = s.split(/[;,]/);
            s = parts[0].trim(); t = (parts[1] || '').trim();
        } else if (!t && / /.test(s) && /\d[:.]\d/.test(s)) {
            const sp = s.split(/\s+/); s = sp[0]; t = sp.slice(1).join(' ');
        }
        const m1 = s.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
        let iso;
        if (m1) {
            let hh = '00', mi = '00', ss = '00';
            if (t) {
                const m2 = t.replace(/\./g, ':').match(/^(\d{2}):?(\d{2}):?(\d{2})?/);
                if (m2) { hh = m2[1]; mi = m2[2]; ss = m2[3] || '00'; }
            }
            iso = m1[1] + '-' + m1[2] + '-' + m1[3] + 'T' + hh + ':' + mi + ':' + ss + 'Z';
        } else {
            const dt = new Date(s + (t ? ' ' + t : ''));
            if (!isNaN(dt.getTime())) return dt.toISOString();
            return null;
        }
        const test = new Date(iso);
        return isNaN(test.getTime()) ? null : test.toISOString();
    }

    function ibClassifyBook(assetClass, symbol, underlying) {
        const sym = (symbol || '').toUpperCase().trim();
        const und = (underlying || '').toUpperCase().trim();
        const isSpyStock  = assetClass === 'STK' && sym === 'SPY';
        const isSpyOption = (assetClass === 'OPT' || assetClass === 'FOP') && (und === 'SPY' || /^SPY\b/.test(sym));
        return (isSpyStock || isSpyOption) ? 'synthetic_passive' : 'engine';
    }

    function ibEsEquivPts(assetClass, symbol, dollars) {
        if (assetClass !== 'FUT' || dollars == null) return null;
        const s = (symbol || '').toUpperCase();
        if (/^MES/.test(s) || /^ES/.test(s)) return Math.round((dollars / 50) * 100) / 100;
        return null; // non-S&P futures: no ES-equivalent point
    }

    function ibStrategy(assetClass) {
        return ({ STK: 'stocks', OPT: 'options', FUT: 'futures', FOP: 'futures_options', CASH: 'forex' })[assetClass] || 'other';
    }
    function ibPeriod(iso) { return (iso && iso.slice(0, 10) >= '2026-05-01') ? 'pre_reg' : 'historical'; }

    // ES-equivalent GROSS price points for ES / MES futures (consistent with the
    // manually-entered /ES record, which is gross price points). pricePts is the
    // per-unit price move; × qty × multiplier / 50 → ES-equivalent points.
    function ibEsEquivFromPoints(assetClass, symbol, pricePts, qty, mult) {
        if (assetClass !== 'FUT') return null;
        const s = (symbol || '').toUpperCase();
        if (!(/^MES/.test(s) || /^ES/.test(s))) return null; // non-S&P future: no ES point
        return Math.round((pricePts * qty * mult / 50) * 100) / 100;
    }

    function ibFlexToTrades(rows, nextId) {
        const keys = Object.keys(rows[0]);
        const pick = function (cands) { return cands.find(function (c) { return keys.indexOf(c) !== -1; }); };
        const K = {
            asset: pick(['assetclass']), sym: pick(['symbol']), under: pick(['underlyingsymbol']),
            side: pick(['buy/sell', 'buysell']), qty: pick(['quantity']),
            price: pick(['tradeprice', 'price']), mult: pick(['multiplier']),
            dt: pick(['datetime', 'date/time']), date: pick(['tradedate', 'date']), time: pick(['tradetime', 'time']),
            oc: pick(['open/closeindicator', 'openclose']), fifo: pick(['fifopnlrealized'])
        };
        const tsOf = function (r) { return ibDateTime(K.dt ? r[K.dt] : (K.date ? r[K.date] : ''), K.dt ? '' : (K.time ? r[K.time] : '')); };

        const out = [];
        let id = nextId;
        const emit = function (o) {
            out.push({
                id: id++,
                timestamp: o.iso || new Date().toISOString(),
                symbol: o.symbol || (o.assetClass === 'FUT' ? '/ES' : ''),
                side: o.side,
                result: o.dollars > 0 ? 'W' : o.dollars < 0 ? 'L' : 'BE',
                pts: o.pts,                                  // ES-equiv GROSS points (futures only) | null
                rawPts: null,
                dollars: Math.round(o.dollars * 100) / 100,  // realized P&L (net, FifoPnlRealized when present)
                qty: o.qty,
                instrument: o.assetClass,
                assetClass: o.assetClass,
                book: ibClassifyBook(o.assetClass, o.symbol, o.underlying),
                tag: 'H3',
                period: ibPeriod(o.iso),
                strategy: ibStrategy(o.assetClass),
                entry: o.openPrice != null ? o.openPrice : null,
                sl: null, tp: null,
                source: 'ib_flex'
            });
        };

        // One unified pass: FIFO-pair executions per instrument so each round-trip
        // has BOTH the open and close price (→ gross ES-equiv points for futures)
        // while taking the dollar P&L from FifoPnlRealized when present (robust to
        // IB BookTrade rows that report a 0/placeholder TradePrice on the close).
        const execs = rows.map(function (r) {
            const assetClass = (r[K.asset] || '').toUpperCase();
            const bs = (r[K.side] || '').toUpperCase();
            const q = Math.abs(ibNum(r[K.qty]) || 0);
            const mult = ibNum(r[K.mult]) || (assetClass === 'OPT' || assetClass === 'FOP' ? 100 : assetClass === 'FUT' ? 50 : 1);
            return {
                assetClass: assetClass, symbol: r[K.sym], underlying: r[K.under],
                key: assetClass + '|' + (r[K.sym] || '') + '|' + (r[K.under] || ''),
                bs: bs, qty: q, signedQty: bs === 'SELL' ? -q : q,
                price: ibNum(r[K.price]) || 0, mult: mult,
                oc: (r[K.oc] || '').toUpperCase(),
                fifo: K.fifo ? ibNum(r[K.fifo]) : null,
                iso: tsOf(r)
            };
        }).sort(function (a, b) { return new Date(a.iso || 0) - new Date(b.iso || 0); });

        const lots = {};
        execs.forEach(function (e) {
            const hasO = e.oc.indexOf('O') !== -1;
            const hasC = e.oc.indexOf('C') !== -1;

            // Single-row round-trip (Open/CloseIndicator = "O;C"): emit directly
            // from its realized P&L (no separate open/close price available).
            if (hasO && hasC) {
                const d = (e.fifo != null) ? e.fifo : 0;
                emit({
                    assetClass: e.assetClass, symbol: e.symbol, underlying: e.underlying,
                    side: e.bs === 'BUY' ? 'LONG' : 'SHORT', qty: e.qty, dollars: d,
                    pts: ibEsEquivPts(e.assetClass, e.symbol, d),  // dollars-based fallback for O;C
                    openPrice: null, iso: e.iso
                });
                return;
            }

            // Pure open ('O'), pure close ('C'), or unmarked: FIFO match against
            // opposite open lots; any unmatched remainder opens a new lot.
            lots[e.key] = lots[e.key] || [];
            let rem = e.signedQty;
            while (rem !== 0 && lots[e.key].length && Math.sign(lots[e.key][0].qty) === -Math.sign(rem)) {
                const lot = lots[e.key][0];
                const matched = Math.min(Math.abs(lot.qty), Math.abs(rem));
                const isLong = lot.qty > 0;
                const pricePts = isLong ? (e.price - lot.price) : (lot.price - e.price);
                const grossDollars = pricePts * matched * e.mult;
                // Net P&L: allocate this close fill's FifoPnlRealized proportionally
                // to the matched qty; fall back to gross price math if absent.
                const dollars = (e.fifo != null && e.qty) ? (e.fifo * (matched / e.qty)) : grossDollars;
                emit({
                    assetClass: e.assetClass, symbol: e.symbol, underlying: e.underlying,
                    side: isLong ? 'LONG' : 'SHORT', qty: matched, dollars: dollars,
                    pts: ibEsEquivFromPoints(e.assetClass, e.symbol, pricePts, matched, e.mult),
                    openPrice: lot.price, iso: e.iso
                });
                lot.qty += isLong ? -matched : matched;
                rem += rem > 0 ? -matched : matched;
                if (lot.qty === 0) lots[e.key].shift();
            }
            if (rem !== 0) lots[e.key].push({ qty: rem, price: e.price });
        });
        return out;
    }

    function handleUpload(text, filename) {
        try {
            // 0. Discord HTML export — three flavors:
            //    (a) custom exporter with `const messages = [...]` embedded JSON
            //    (b) DiscordChatExporter DOM-based format (chatlog__ classes)
            //    (c) Zingfront-style export (ul.chatContent + .timeInfo)
            const isHtml = (filename && /\.html?$/i.test(filename))
                || /class=["']?chatlog__/i.test(text)
                || /const\s+messages\s*=\s*\[/.test(text)
                || /class=["']chatContent["']/.test(text);
            if (isHtml) {
                let journal = null;
                let source = '';
                journal = customDiscordJsonToJournal(text);
                if (journal) source = 'embedded-JSON Discord export';
                if (!journal) {
                    journal = zingfrontHtmlToJournal(text);
                    if (journal) source = 'Zingfront-style Discord export';
                }
                if (!journal) {
                    journal = discordHtmlToJournal(text);
                    if (journal) source = 'DiscordChatExporter HTML';
                }
                if (!journal) throw new Error('Could not extract any messages from the HTML file.');
                if (!looksLikeJournal(journal)) {
                    throw new Error('HTML parsed (' + source + '), but no result lines (e.g. "M1: +21") were found in the messages.');
                }
                const parsed = parseEkantikJournal(journal);
                if (!parsed.length) throw new Error('HTML parsed, but no complete trade blocks. Make sure messages have a label + signed points (e.g. "M1: +21").');
                const startId = CURRENT.trades.length + STAGED.length + 1;
                parsed.forEach(function (t, i) { t.id = startId + i; });
                STAGED = STAGED.concat(parsed);
                renderPreview(); renderKpis();
                status('✓ Imported ' + parsed.length + ' trade ' + (parsed.length === 1 ? 'block' : 'blocks') + ' from ' + source + '.', 'success');
                return;
            }

            // 1. Ekantik journal format detection (date + label:s/b/sl/tp + result line)
            if (looksLikeJournal(text)) {
                const parsed = parseEkantikJournal(text);
                if (!parsed.length) throw new Error('Journal format detected but no complete trade blocks parsed.');
                const startId = CURRENT.trades.length + STAGED.length + 1;
                parsed.forEach(function (t, i) { t.id = startId + i; });
                STAGED = STAGED.concat(parsed);
                renderPreview(); renderKpis();
                status('✓ Parsed ' + parsed.length + ' trade ' + (parsed.length === 1 ? 'block' : 'blocks') + ' from Ekantik journal format.', 'success');
                return;
            }

            // 2. JSON detection
            let rows;
            if ((filename && /\.json$/i.test(filename)) || text.trim().charAt(0) === '[' || text.trim().charAt(0) === '{') {
                const json = JSON.parse(text);
                if (json.trades && Array.isArray(json.trades)) {
                    // Native trades.json shape — accept directly
                    STAGED = STAGED.concat(json.trades);
                    renderPreview(); renderKpis();
                    status('✓ Loaded ' + json.trades.length + ' trades from ' + (filename || 'paste') + ' (native trades.json shape).', 'success');
                    return;
                }
                rows = Array.isArray(json) ? json : (json.data || []);
                rows = rows.map(function (r) {
                    const norm = {};
                    Object.keys(r).forEach(function (k) { norm[k.toLowerCase().replace(/\s+/g, '_')] = r[k]; });
                    return norm;
                });
            } else {
                // 3. CSV fallback
                rows = parseCSV(text);
                if (!rows) throw new Error('Could not parse CSV or detect a known format.');
            }
            const startId = CURRENT.trades.length + STAGED.length + 1;
            // 3a. Interactive Brokers Flex Query (Trades) CSV — routed to a dedicated
            //     round-trip parser that tags book (engine vs synthetic_passive) + assetClass.
            if (looksLikeIbFlex(rows)) {
                const ibTrades = ibFlexToTrades(rows, startId);
                if (!ibTrades.length) throw new Error('IB Flex Query detected but no closing trades found. Ensure the query includes closing executions (Open/CloseIndicator) and, ideally, FifoPnlRealized.');
                STAGED = STAGED.concat(ibTrades);
                renderPreview(); renderKpis();
                const sp = ibTrades.filter(function (t) { return t.book === 'synthetic_passive'; }).length;
                const eng = ibTrades.length - sp;
                status('✓ Imported ' + ibTrades.length + ' IB round-trips (' + eng + ' Booster Engine · ' + sp + ' Synthetic-Passive SPY).', 'success');
                return;
            }
            const parsed = rowsToTrades(rows, startId);
            if (!parsed.length) throw new Error('No valid trades detected. Need at least a points/pnl column.');
            STAGED = STAGED.concat(parsed);
            renderPreview(); renderKpis();
            status('✓ Staged ' + parsed.length + ' trades from ' + (filename || 'paste') + '.', 'success');
        } catch (e) {
            status('Parse failed: ' + e.message, 'error');
        }
    }

    /* ---------- Ekantik journal parser ----------
       Format (one block per trade):
         <M/D/YY h.mm AM|PM>
         <LABEL>: <s|b> <entry_price>
         <LABEL>: sl<stop_loss>            (optional, informational)
         <LABEL>: tp<trailing_profit>      (optional, informational)
         <blank line>
         <LABEL>: +/-<points> H2|H3
       LABEL is anything matching M\w+ (e.g. MO1, M01, MO2, MES, etc.)
       Multiple trades may be separated by blank lines and/or new date headers.
    */
    // Per-line patterns. Prefix is any letter+word (M1, MO1, F1, MES, SPX, etc.),
    // optionally followed by trailing non-word punctuation like `^`, `*`, `!`, `?`,
    // `#`, etc. — these are preserved in the source channel but treated as
    // cosmetic (e.g. `M1^: +38` parses as a result line; the `^` is dropped).
    const LABEL_RE_FRAG = '[A-Za-z]\\w*[^\\s:]*';
    // Entry: starts with label, then s/b side letter, then price.
    // Whitespace between side and price is OPTIONAL — accepts "b 7584" AND "b7584"
    // (previously required \s+, which silently dropped the operator's M31 line
    //  "M31: b7584 2mes sl7573" — see PR fix/admin-parser-mes-bug).
    // Side letter must be followed by a digit (the `\d+` group), so word-prefixed
    // tokens like "be -3", "brigade", "backtest" still don't match.
    // Allows trailing inline SL/TP (parsed separately).
    const JOURNAL_ENTRY_RE  = new RegExp('^\\s*' + LABEL_RE_FRAG + '\\s*:\\s*([sbSB])\\s*(\\d+(?:\\.\\d+)?)');
    // Result: signed points required. Tag (H2/H3/BE) optional — defaults to H3 if absent.
    const JOURNAL_RESULT_RE = new RegExp('^\\s*' + LABEL_RE_FRAG + '\\s*:\\s*([+-]\\d+(?:\\.\\d+)?)(?:\\s+([Hh][23]|BE|be))?\\s*$');
    const JOURNAL_SL_RE     = /\bsl\s*(\d+(?:\.\d+)?)/i;  // unanchored so it matches inline too
    const JOURNAL_TP_RE     = /\btp\s*(\d+(?:\.\d+)?)/i;
    // Size annotation: "5mes", "2 es", "1mes", "/ES", "/MES". Captures qty + instrument.
    // Qty defaults to 1 when only the instrument token is present (e.g. "/ES").
    const JOURNAL_SIZE_RE   = /(?:(\d+)\s*)?\/?(mes|es)\b/i;
    // Used as a quick "is this a label-prefixed line?" sniff for standalone SL/TP detection.
    const LABEL_PREFIX_RE   = new RegExp('^\\s*' + LABEL_RE_FRAG + '\\s*:');

    // Timestamp variants encountered in Discord paste / journal headers
    const TS_FULL_DATE_RE  = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)?\b/;
    const TS_TODAY_RE      = /\bToday\s+at\s+(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)/i;
    const TS_YESTERDAY_RE  = /\bYesterday\s+at\s+(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)/i;
    const TS_TIME_ONLY_RE  = /(?:^|[\s\[—\-])(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)\b/;

    // Detection: any result line is enough to trigger journal parsing.
    function looksLikeJournal(text) {
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) if (JOURNAL_RESULT_RE.test(lines[i])) return true;
        return false;
    }

    /* Extract a timestamp from a single line. Returns a Date or null.
       Handles full date+time, 'Today at', 'Yesterday at', and bare time-only
       (in which case the date defaults to today). */
    function extractTimestamp(line) {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Full date M/D/YY h:mm AM/PM
        let m = trimmed.match(TS_FULL_DATE_RE);
        if (m) {
            let yr = parseInt(m[3], 10); if (yr < 100) yr += 2000;
            let hr = parseInt(m[4], 10);
            const min = parseInt(m[5], 10);
            const ampm = (m[6] || '').toUpperCase();
            if (ampm === 'PM' && hr < 12) hr += 12;
            if (ampm === 'AM' && hr === 12) hr = 0;
            return new Date(yr, parseInt(m[1], 10) - 1, parseInt(m[2], 10), hr, min, 0);
        }
        // 'Today at h:mm AM/PM'
        m = trimmed.match(TS_TODAY_RE);
        if (m) {
            const d = new Date();
            let hr = parseInt(m[1], 10);
            if (/pm/i.test(m[3]) && hr < 12) hr += 12;
            if (/am/i.test(m[3]) && hr === 12) hr = 0;
            d.setHours(hr, parseInt(m[2], 10), 0, 0);
            return d;
        }
        // 'Yesterday at h:mm AM/PM'
        m = trimmed.match(TS_YESTERDAY_RE);
        if (m) {
            const d = new Date(); d.setDate(d.getDate() - 1);
            let hr = parseInt(m[1], 10);
            if (/pm/i.test(m[3]) && hr < 12) hr += 12;
            if (/am/i.test(m[3]) && hr === 12) hr = 0;
            d.setHours(hr, parseInt(m[2], 10), 0, 0);
            return d;
        }
        // Bare time only — assume today
        m = trimmed.match(TS_TIME_ONLY_RE);
        if (m) {
            // Reject if the line itself is a known trade line (avoid eating "F1: +12 H3" times)
            if (JOURNAL_ENTRY_RE.test(trimmed) || JOURNAL_RESULT_RE.test(trimmed)
                || JOURNAL_SL_RE.test(trimmed) || JOURNAL_TP_RE.test(trimmed)) return null;
            const d = new Date();
            let hr = parseInt(m[1], 10);
            if (/pm/i.test(m[3]) && hr < 12) hr += 12;
            if (/am/i.test(m[3]) && hr === 12) hr = 0;
            d.setHours(hr, parseInt(m[2], 10), 0, 0);
            return d;
        }
        return null;
    }

    /* Zingfront-style Discord HTML export → flattened journal text
       Format observed: <ul class="chatContent"><li>... with <p class="timeInfo">
       (author + timestamp) and a sibling <p> containing the message body.
       Avatar src points at static-global.zingfront.com. */
    function zingfrontHtmlToJournal(html) {
        let doc;
        try { doc = new DOMParser().parseFromString(html, 'text/html'); }
        catch (e) { return null; }
        if (!doc || !doc.body) return null;

        const items = doc.querySelectorAll('ul.chatContent > li, .chatContent > li');
        if (!items.length) return null;

        const blocks = [];
        items.forEach(function (li) {
            const timeEl = li.querySelector('.time');
            let tsFormatted = '';
            if (timeEl) {
                // "Fri May 22 2026 10:35:58 GMT-0500 (Central Daylight Time)" — JS Date parses cleanly
                tsFormatted = formatDiscordTs(timeEl.textContent.trim());
            }
            // The message body <p> is any <p> in .titleInfo that does NOT have class="timeInfo"
            const titleInfo = li.querySelector('.titleInfo');
            const lines = [];
            if (titleInfo) {
                titleInfo.querySelectorAll('p').forEach(function (p) {
                    if (p.classList.contains('timeInfo')) return;
                    const text = (p.textContent || '').replace(/ /g, ' ').trim();
                    if (text) lines.push(text);
                });
            }
            if (!lines.length) return;
            blocks.push((tsFormatted ? tsFormatted + '\n' : '') + lines.join('\n'));
        });
        return blocks.join('\n\n');
    }

    /* Custom Discord HTML export → flattened journal text
       Some exporters embed the full message array as a JSON literal inside a
       <script> tag: `const messages = [{...}, {...}];`. Extract that array
       directly — far more reliable than DOM walking. */
    function customDiscordJsonToJournal(html) {
        const m = html.match(/const\s+messages\s*=\s*(\[[\s\S]*?\]);/);
        if (!m) return null;
        let arr;
        try { arr = JSON.parse(m[1]); }
        catch (e) { return null; }
        if (!Array.isArray(arr) || !arr.length) return null;

        // Sort chronologically just in case
        arr.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });

        const blocks = arr.map(function (msg) {
            const content = (msg.content || '').trim();
            if (!content) return null;
            const ts = msg.timestamp ? new Date(msg.timestamp) : null;
            const tsLine = ts && !isNaN(ts.getTime()) ? formatDiscordTs(ts.toISOString()) : '';
            return (tsLine ? tsLine + '\n' : '') + content;
        }).filter(Boolean);
        return blocks.join('\n\n');
    }

    /* DiscordChatExporter HTML → flattened journal text
       Walks the parsed DOM, finds each message group's timestamp + content,
       and emits "M/D/YY h.mm AM\n<content>\n\n" so the existing journal
       parser handles the rest. Falls back to scraping any message-like text.
    */
    function discordHtmlToJournal(html) {
        let doc;
        try { doc = new DOMParser().parseFromString(html, 'text/html'); }
        catch (e) { return null; }
        if (!doc || !doc.body) return null;

        const blocks = [];
        // DiscordChatExporter "Exclusive" template (most common): chatlog__message-group
        let groups = doc.querySelectorAll('.chatlog__message-group, [class*="chatlog__message-group"]');
        if (!groups.length) groups = doc.querySelectorAll('[class*="messageGroup"]');
        if (!groups.length) {
            // Fallback: treat every message element independently
            const msgs = doc.querySelectorAll('[class*="chatlog__message"], [class*="messageContent"]');
            msgs.forEach(function (m) {
                const text = (m.textContent || '').trim();
                if (text) blocks.push(text);
            });
            return blocks.join('\n\n');
        }

        groups.forEach(function (g) {
            // Timestamp on the group or first message
            const tsEl = g.querySelector('[class*="timestamp"], [data-timestamp], time');
            let tsText = '';
            if (tsEl) {
                tsText = (tsEl.getAttribute('title') || tsEl.getAttribute('data-timestamp') || tsEl.textContent || '').trim();
            }
            const tsFormatted = formatDiscordTs(tsText);

            // Collect all message content within the group
            const msgs = g.querySelectorAll('[class*="messageContent"], [class*="chatlog__content"], [class*="markup"]');
            const lines = [];
            msgs.forEach(function (m) {
                const text = (m.textContent || '').replace(/\s+\n/g, '\n').trim();
                if (text) lines.push(text);
            });
            if (!lines.length) return;

            if (tsFormatted) blocks.push(tsFormatted + '\n' + lines.join('\n'));
            else             blocks.push(lines.join('\n'));
        });
        return blocks.join('\n\n');
    }

    /* Convert various Discord timestamp shapes into the M/D/YY h.mm AM journal header */
    function formatDiscordTs(raw) {
        if (!raw) return '';
        // Try ISO-ish (DiscordChatExporter "title" attribute is usually "Friday, May 19, 2026 12:09 PM")
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            const mm = d.getMonth() + 1;
            const dd = d.getDate();
            const yy = String(d.getFullYear()).slice(-2);
            let h = d.getHours();
            const min = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12; if (h === 0) h = 12;
            return mm + '/' + dd + '/' + yy + ' ' + h + '.' + min + ' ' + ampm;
        }
        return raw; // emit as-is; journal regex may still match if it's already close
    }

    /* Line-walking parser. Emits a trade for every result line encountered,
       using the most recent timestamp + entry/sl/tp seen above it. Forgiving
       about block boundaries — Discord paste, Ekantik journal, or just bare
       result lines all work. */
    function parseEkantikJournal(text) {
        const lines = text.split(/\r?\n/);
        const trades = [];

        let lastTs = null;          // Date object
        let pendingEntry = null;    // { side, entry }
        let pendingSl = null;
        let pendingTp = null;
        let pendingSize = null;     // { qty, instrument: 'ES'|'MES', esEquiv, dollarPerPoint }
        let resultIndex = 0;        // for nudging timestamps when many results share a time

        const isOptions = currentStrategy() === 'options';
        const sym = defaultSymbol();

        // Resolve a size annotation match into a normalized size record.
        // /ES: 1 contract = $50/pt = 1.0 ES-equivalent
        // /MES: 1 contract = $5/pt  = 0.1 ES-equivalent
        function resolveSize(m) {
            const qty = m[1] ? parseInt(m[1], 10) : 1;
            const inst = m[2].toUpperCase();
            const isMicro = inst === 'MES';
            return {
                qty: qty,
                instrument: inst,
                esEquiv: isMicro ? qty / 10 : qty,
                dollarPerPoint: isMicro ? 5 : 50
            };
        }

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();
            if (!trimmed) continue;

            // Timestamp line — capture and continue
            const ts = extractTimestamp(trimmed);
            if (ts) { lastTs = ts; continue; }

            // Trade structure lines
            const em = trimmed.match(JOURNAL_ENTRY_RE);
            if (em) {
                pendingEntry = { side: em[1].toLowerCase() === 's' ? 'SHORT' : 'LONG', entry: parseFloat(em[2]) };
                // Also capture inline SL/TP if present on the same line (e.g. "M3: s 7414 SL7426 tp7381")
                const inlineSl = trimmed.match(JOURNAL_SL_RE);
                if (inlineSl) pendingSl = parseFloat(inlineSl[1]);
                const inlineTp = trimmed.match(JOURNAL_TP_RE);
                if (inlineTp) pendingTp = parseFloat(inlineTp[1]);
                // Inline size annotation: "5mes", "2es", "/ES". Strip SL/TP fragments first
                // so we don't match the digits inside "sl7553" or "tp7531".
                const sizeScan = trimmed
                    .replace(/\bsl\s*\d+(?:\.\d+)?/ig, '')
                    .replace(/\btp\s*\d+(?:\.\d+)?/ig, '');
                const inlineSize = sizeScan.match(JOURNAL_SIZE_RE);
                if (inlineSize) pendingSize = resolveSize(inlineSize);
                continue;
            }
            // Standalone SL/TP lines (label-prefixed): only fire if the line starts with a label
            if (LABEL_PREFIX_RE.test(trimmed)) {
                const sl = trimmed.match(JOURNAL_SL_RE);
                if (sl && !em) { pendingSl = parseFloat(sl[1]); continue; }
                const tp = trimmed.match(JOURNAL_TP_RE);
                if (tp && !em) { pendingTp = parseFloat(tp[1]); continue; }
            }

            const rm = trimmed.match(JOURNAL_RESULT_RE);
            if (rm) {
                const rawPts = parseFloat(rm[1]);
                // Tag defaults to H3 (variance, OP-04 resting attribution) when absent
                let tag = (rm[2] || 'H3').toUpperCase();
                if (tag === 'H1') tag = 'H3';

                // Timestamp fallback: if none was seen yet, use now() and nudge by index.
                let tradeDate;
                if (lastTs) {
                    tradeDate = new Date(lastTs.getTime() + resultIndex * 1000);
                } else {
                    tradeDate = new Date(Date.now() + resultIndex * 1000);
                }
                resultIndex++;

                // Normalize to /ES-equivalent units.
                // Options pass through with $1/pt multiplier.
                // If no size was seen, fall back to the operator's "Default size"
                // preference (admin.html <select id="adminDefaultSize">). Trades
                // hitting the fallback path are tagged _sizeFromFallback so the
                // import preview can WARN the operator before publishing —
                // closing the silent-default footgun that caused PR #105 and
                // PR #107.
                let esEquiv, dollarPerPoint, qty, instrument, sizeFromFallback = false;
                if (isOptions) {
                    esEquiv = 1; dollarPerPoint = 1; qty = 1; instrument = 'OPT';
                } else if (pendingSize) {
                    esEquiv = pendingSize.esEquiv;
                    dollarPerPoint = pendingSize.dollarPerPoint;
                    qty = pendingSize.qty;
                    instrument = pendingSize.instrument;
                } else {
                    const def = resolveDefaultSize();
                    esEquiv = def.esEquiv;
                    dollarPerPoint = def.dollarPerPoint;
                    qty = def.qty;
                    instrument = def.instrument;
                    sizeFromFallback = true;
                }
                const normPts = rawPts * esEquiv;
                const dollars = rawPts * qty * dollarPerPoint;

                trades.push({
                    timestamp: tradeDate.toISOString(),
                    symbol: instrument === 'MES' ? '/MES' : sym,
                    side: pendingEntry ? pendingEntry.side : '',
                    result: rawPts > 0 ? 'W' : rawPts < 0 ? 'L' : 'BE',
                    pts: Math.round(normPts * 100) / 100,            // /ES-equivalent
                    rawPts: Math.round(rawPts * 100) / 100,          // as logged
                    dollars: Math.round(dollars * 100) / 100,
                    qty: qty,
                    instrument: instrument,
                    tag: tag,
                    period: 'pre_reg',
                    strategy: currentStrategy(),
                    entry: pendingEntry ? pendingEntry.entry : null,
                    sl: pendingSl,
                    tp: pendingTp,
                    // _sizeFromFallback is a UI-only tag — renderPreview() shows
                    // a warning and buildJson() strips it before publish.
                    _sizeFromFallback: sizeFromFallback
                });

                // Reset trade context — next result starts fresh
                pendingEntry = null;
                pendingSl = null;
                pendingTp = null;
                pendingSize = null;
                continue;
            }

            // Standalone size-annotation line, e.g. "2mes", "/ES", "5 mes sl7553".
            // Fires only inside a trade context (entry seen OR size pending) and
            // only when the line ISN'T already consumed by entry / SL / TP / result.
            // Fixes the case where the operator's Discord splits "M30: b 7594"
            // and "2mes sl7584" across two messages — previously the second line
            // was silently dropped because LABEL_PREFIX_RE didn't match.
            if (!pendingSize && (pendingEntry || pendingSl != null)) {
                const sizeOnly = trimmed
                    .replace(/\bsl\s*\d+(?:\.\d+)?/ig, '')
                    .replace(/\btp\s*\d+(?:\.\d+)?/ig, '');
                const m2 = sizeOnly.match(JOURNAL_SIZE_RE);
                if (m2) {
                    pendingSize = resolveSize(m2);
                    // Also consume inline SL on this same line if present.
                    const slInline = trimmed.match(JOURNAL_SL_RE);
                    if (slInline && pendingSl == null) pendingSl = parseFloat(slInline[1]);
                    const tpInline = trimmed.match(JOURNAL_TP_RE);
                    if (tpInline && pendingTp == null) pendingTp = parseFloat(tpInline[1]);
                    continue;
                }
            }
            // Author lines / other noise — ignore
        }
        return trades;
    }

    document.getElementById('adminFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const fr = new FileReader();
        fr.onload = function () { handleUpload(fr.result, f.name); };
        fr.readAsText(f);
    });
    const drop = document.querySelector('.discord-drop');
    if (drop) {
        ['dragenter','dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-dragover'); }); });
        ['dragleave','drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); }); });
        drop.addEventListener('drop', function (e) {
            const f = e.dataTransfer.files[0]; if (!f) return;
            const fr = new FileReader();
            fr.onload = function () { handleUpload(fr.result, f.name); };
            fr.readAsText(f);
        });
    }
    document.getElementById('adminPasteBtn').addEventListener('click', function () {
        const text = document.getElementById('adminPaste').value;
        if (!text.trim()) { status('Paste some CSV or JSON first.', 'error'); return; }
        handleUpload(text, null);
    });

    /* ---------- Single trade form ---------- */
    document.getElementById('adminSingleForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(this);
        const pts = parseFloat(fd.get('pts'));
        if (isNaN(pts)) { status('Enter a numeric points value.', 'error'); return; }
        const ts = fd.get('timestamp') ? new Date(fd.get('timestamp')).toISOString() : new Date().toISOString();
        const t = {
            id: CURRENT.trades.length + STAGED.length + 1,
            timestamp: ts,
            symbol: (fd.get('symbol') || '/ES').toString(),
            side: (fd.get('side') || '').toString(),
            result: pts > 0 ? 'W' : pts < 0 ? 'L' : 'BE',
            pts: Math.round(pts * 100) / 100,
            dollars: Math.round(pts * 50 * 100) / 100,
            tag: (fd.get('tag') || 'H3').toString(),
            period: (fd.get('period') || 'pre_reg').toString()
        };
        STAGED.push(t);
        renderPreview(); renderKpis();
        status('✓ Staged single trade (pts=' + t.pts + ').', 'success');
        this.reset();
        this.elements.symbol.value = '/ES';
    });

    /* ---------- Preview pane ---------- */
    function renderPreview() {
        const wrap = document.getElementById('adminPreview');
        const body = document.getElementById('adminPreviewBody');
        const count = document.getElementById('adminPreviewCount');
        wrap.hidden = STAGED.length === 0;
        count.textContent = STAGED.length;

        // Surface trades that fell back to the operator's default size — these
        // are the rows most likely to be wrong (the cause of PRs #105, #107).
        const warn = document.getElementById('adminFallbackWarn');
        const warnBody = document.getElementById('adminFallbackWarnBody');
        if (warn && warnBody) {
            const fallbackRows = STAGED
                .map(function (t, i) { return t._sizeFromFallback ? (i + 1) : null; })
                .filter(function (n) { return n !== null; });
            if (fallbackRows.length) {
                const def = readDefaultSizeCode().replace(/^(\d+)/, '$1 /');
                warnBody.innerHTML =
                    '<strong>' + fallbackRows.length + ' of ' + STAGED.length + ' trades</strong> had no explicit size token in the Discord and were imported as your current default <strong>' + def + '</strong>. '
                  + 'Verify <strong>row' + (fallbackRows.length === 1 ? ' #' : 's #') + fallbackRows.join(', #') + '</strong> before publishing — or change the <em>Default size</em> selector above and re-import.';
                warn.hidden = false;
            } else {
                warn.hidden = true;
            }
        }

        body.innerHTML = STAGED.map(function (t, idx) {
            const date = new Date(t.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
            const hasPts = (typeof t.pts === 'number');
            // Colour by points when present, else by the dollar P&L (IB stocks/options).
            const pnlNum = hasPts ? t.pts : (typeof t.dollars === 'number' ? t.dollars : 0);
            const ptsClass = pnlNum > 0 ? 'pos' : pnlNum < 0 ? 'neg' : 'zero';

            // P&L cell: points-denominated trades (ES/MES futures, journal) show
            // as-logged points with /ES-equiv norm; dollar-denominated trades
            // (IB stocks / options / non-ES futures, pts=null) show the $ P&L.
            let pnlCell;
            if (hasPts) {
                const displayRaw = (typeof t.rawPts === 'number') ? t.rawPts : t.pts;
                const showNorm = t.instrument === 'MES' || (t.qty && t.qty > 1 && /^(ES|MES)/.test(String(t.symbol||'')));
                const normSuffix = showNorm
                    ? ' <span style="color:var(--slate);font-size:11px">(' + (t.pts>=0?'+':'') + t.pts.toFixed(2) + ' /ES eq)</span>'
                    : '';
                pnlCell = (displayRaw>=0?'+':'') + displayRaw.toFixed(2) + normSuffix;
            } else {
                const d = (typeof t.dollars === 'number') ? t.dollars : 0;
                pnlCell = '<span title="Dollar-denominated — no ES-equivalent point for this asset class">' + (d>=0?'+$':'−$') + Math.abs(d).toLocaleString() + '</span>';
            }

            // Size / asset badge.
            const sizeBadge = (t.qty && t.instrument && t.instrument !== 'OPT' && t.instrument !== 'STK')
                ? ' <span style="color:var(--slate);font-size:11px">· ' + t.qty + ' /' + t.instrument
                + (t._sizeFromFallback ? ' <span title="Size came from your Default size preference — no explicit token in the Discord line. Verify before publishing." style="color:var(--gold-deep);font-weight:700">⚠ default</span>' : '')
                + '</span>'
                : (t.qty && (t.instrument === 'STK' || t.instrument === 'OPT')
                    ? ' <span style="color:var(--slate);font-size:11px">· ' + t.qty + ' ' + t.instrument + '</span>'
                    : '');
            // Book badge for bucketed (IB) trades — engine vs synthetic-passive SPY.
            const bookBadge = t.book
                ? ' <span style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;font-weight:700;color:' + (t.book === 'synthetic_passive' ? '#64748B' : 'var(--gold-deep)') + '">· ' + (t.book === 'synthetic_passive' ? 'SPY' : 'engine') + '</span>'
                : '';
            const rowStyle = t._sizeFromFallback ? ' style="background:rgba(184,150,46,0.06)"' : '';
            return '<tr' + rowStyle + '>'
                 + '<td>' + (idx+1) + '</td>'
                 + '<td>' + date + '</td>'
                 + '<td>' + (t.symbol||'/ES') + sizeBadge + bookBadge + '</td>'
                 + '<td>' + (t.side||'—') + '</td>'
                 + '<td>' + t.result + '</td>'
                 + '<td class="num ' + ptsClass + '">' + pnlCell + '</td>'
                 + '<td><span class="tag tag--' + (t.tag||'H3') + '">' + (t.tag||'H3') + '</span></td>'
                 + '</tr>';
        }).join('');
    }

    document.getElementById('adminClearStage').addEventListener('click', function () {
        if (!STAGED.length) return;
        if (confirm('Clear ' + STAGED.length + ' staged trades?')) {
            STAGED = [];
            renderPreview(); renderKpis();
            status('Stage cleared.', 'info');
        }
    });

    /* ---------- Build & download ---------- */
    document.getElementById('adminBuildJson').addEventListener('click', function () {
        if (!STAGED.length) { status('Nothing staged to merge.', 'error'); return; }
        const mode = (document.querySelector('input[name="mergeMode"]:checked')||{}).value || 'merge';
        let merged;
        if (mode === 'replace') {
            merged = STAGED.slice();
        } else {
            // Dedupe by id; staged wins on conflict
            const map = {};
            CURRENT.trades.forEach(function (t) { map[t.id] = t; });
            STAGED.forEach(function (t) { map[t.id] = t; });
            merged = Object.keys(map).map(function (k) { return map[k]; });
        }
        // Sort chronological, re-id
        merged.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        merged.forEach(function (t, i) {
            t.id = i + 1;
            // Strip UI-only flags so they don't leak into the published JSON.
            if ('_sizeFromFallback' in t) delete t._sizeFromFallback;
        });

        const output = {
            meta: {
                version: (CURRENT.meta.version || 1) + 1,
                dataset_label: CURRENT.meta.dataset_label || 'Ekantik 500 trade record',
                dataset_range: deriveRange(merged),
                last_updated: new Date().toISOString(),
                description: CURRENT.meta.description || 'Operator live trading record on the Majority Opinion Predisposal Strategy. Pre-committed protocol: see /falsifiability-protocol.html'
            },
            trades: merged
        };

        showOutput(output);
        status('✓ Built new trades.json (' + merged.length + ' trades, mode: ' + mode + ').', 'success');
    });

    function deriveRange(trades) {
        if (!trades.length) return '';
        const first = new Date(trades[0].timestamp);
        const last = new Date(trades[trades.length-1].timestamp);
        const fmt = function (d) { return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
        return fmt(first) + ' – ' + fmt(last);
    }

    let LAST_OUTPUT = null;
    function showOutput(json) {
        LAST_OUTPUT = json;
        const panel = document.getElementById('adminOutputPanel');
        panel.hidden = false;
        const wins = json.trades.filter(function (t) { return t.pts > 0 || (t.pts == null && t.dollars > 0); }).length;
        const losses = json.trades.filter(function (t) { return t.pts < 0 || (t.pts == null && t.dollars < 0); }).length;
        // Total pts is ES-equivalent only (numeric pts); dollar-denominated IB
        // booster/SPY trades don't contribute an ES point.
        const total = json.trades.reduce(function (a, t) { return a + (typeof t.pts === 'number' ? t.pts : 0); }, 0);
        document.getElementById('adminOutputStats').innerHTML =
              '<div><em>Trades</em><strong>' + json.trades.length + '</strong></div>'
            + '<div><em>W / L</em><strong>' + wins + ' / ' + losses + '</strong></div>'
            + '<div><em>Total pts</em><strong>' + (total>=0?'+':'') + total.toFixed(0) + ' ES-eq</strong></div>';
        document.getElementById('adminJsonPreview').textContent = JSON.stringify(json, null, 2);
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.getElementById('adminDownload').addEventListener('click', function () {
        if (!LAST_OUTPUT) return;
        const blob = new Blob([JSON.stringify(LAST_OUTPUT, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'trades.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    document.getElementById('adminCopyJson').addEventListener('click', function () {
        if (!LAST_OUTPUT) return;
        const text = JSON.stringify(LAST_OUTPUT, null, 2);
        navigator.clipboard.writeText(text).then(function () {
            status('✓ JSON copied to clipboard.', 'success');
        }).catch(function () {
            status('Clipboard write failed — use Download instead.', 'error');
        });
    });

    /* ---------- GitHub direct publish ----------
       Commits the merged trades.json straight to main via the GitHub REST API.
       PAT is fine-grained, repo-scoped (Contents: write), stored in localStorage
       on this device only — never sent anywhere except api.github.com.
    */
    const GH_OWNER = 'EkantikCapitalAdvisors';
    const GH_REPO  = 'EPIG500';
    const GH_PATH  = 'data/trades.json';
    const GH_BRANCH = 'main';
    const PAT_KEY  = 'epig500_admin_gh_pat_v1';

    function getPat() { try { return localStorage.getItem(PAT_KEY) || ''; } catch (e) { return ''; } }
    function setPat(v) { try { localStorage.setItem(PAT_KEY, v); } catch (e) {} }
    function clearPatStorage() { try { localStorage.removeItem(PAT_KEY); } catch (e) {} }

    function refreshPatStatus() {
        const hasToken = !!getPat();
        const el = document.getElementById('adminPatStatus');
        if (el) el.textContent = hasToken ? '✓ Token saved on this device' : 'No token saved';
        const inline = document.getElementById('adminPatStatusInline');
        if (inline) inline.textContent = hasToken ? '· ✓ token saved' : '· no token — click to set up';
        const input = document.getElementById('adminPatInput');
        if (input && hasToken && !input.value) input.placeholder = '••• token saved — paste to overwrite';
    }
    refreshPatStatus();

    // Test the saved token by hitting /repos/{owner}/{repo} — surfaces 401/403 immediately.
    const testBtn = document.getElementById('adminPatTest');
    if (testBtn) testBtn.addEventListener('click', async function () {
        const token = getPat();
        const el = document.getElementById('adminPatStatus');
        if (!token) { el.textContent = 'Save a token first.'; return; }
        el.textContent = 'Testing…';
        try {
            await ghRequest('GET', 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO, token);
            el.textContent = '✓ Token works — repo access confirmed.';
        } catch (e) {
            el.textContent = '✗ ' + String(e.message || e);
        }
    });

    document.getElementById('adminPatSave').addEventListener('click', function () {
        const v = (document.getElementById('adminPatInput').value || '').trim();
        if (!v) { document.getElementById('adminPatStatus').textContent = 'Paste a token first.'; return; }
        setPat(v);
        document.getElementById('adminPatInput').value = '';
        refreshPatStatus();
    });
    document.getElementById('adminPatClear').addEventListener('click', function () {
        clearPatStorage();
        document.getElementById('adminPatInput').value = '';
        refreshPatStatus();
    });

    function pubStatus(msg, kind) {
        const el = document.getElementById('adminPublishStatus');
        el.hidden = false;
        el.className = 'admin-status admin-status--' + (kind || 'info');
        el.innerHTML = msg;
    }

    // Encode a UTF-8 string to base64 (handles non-ASCII correctly).
    function utf8ToBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    async function ghRequest(method, url, token, body) {
        const headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': 'Bearer ' + token,
            'X-GitHub-Api-Version': '2022-11-28'
        };
        if (body) headers['Content-Type'] = 'application/json';
        const res = await fetch(url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) {
            const errMsg = (json && json.message) ? json.message : (text || ('HTTP ' + res.status));
            throw new Error(errMsg);
        }
        return json;
    }

    async function publishToGitHub(outputJson) {
        const token = getPat();
        if (!token) {
            pubStatus('No PAT saved. Open <strong>GitHub publishing settings</strong> below and paste a fine-grained PAT first.', 'error');
            document.getElementById('adminPatPanel').open = true;
            return;
        }
        const btn = document.getElementById('adminPublish');
        btn.disabled = true;
        const origLabel = btn.textContent;
        btn.textContent = 'Publishing…';
        try {
            pubStatus('Reading current trades.json from <code>main</code>…', 'info');
            const getUrl = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH + '?ref=' + GH_BRANCH;
            const existing = await ghRequest('GET', getUrl, token);
            const sha = existing.sha;

            const contentStr = JSON.stringify(outputJson, null, 2) + '\n';
            const tradesCount = outputJson.trades.length;
            const prevCount = (existing.content)
                ? (function () {
                    try {
                        const prev = JSON.parse(atob(existing.content.replace(/\n/g, '')));
                        return (prev.trades || []).length;
                    } catch (e) { return null; }
                })()
                : null;
            const deltaStr = (prevCount === null) ? '' : (' (' + tradesCount + ' total · ' + (tradesCount - prevCount >= 0 ? '+' : '') + (tradesCount - prevCount) + ' vs previous)');

            pubStatus('Committing to <code>main</code>…', 'info');
            const putUrl = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
            const commit = await ghRequest('PUT', putUrl, token, {
                message: 'Update trade record via admin' + deltaStr,
                content: utf8ToBase64(contentStr),
                sha: sha,
                branch: GH_BRANCH
            });

            const commitSha = (commit.commit && commit.commit.sha) ? commit.commit.sha.slice(0, 7) : '';
            const commitUrl = (commit.commit && commit.commit.html_url) ? commit.commit.html_url : '';
            pubStatus(
                '✓ Committed to <code>main</code> @ <code>' + commitSha + '</code>' + deltaStr
                + (commitUrl ? ' · <a href="' + commitUrl + '" target="_blank" rel="noopener">view commit ↗</a>' : '')
                + '<br><span style="font-size:12px;color:var(--slate)">GitHub Pages typically redeploys within ~30 seconds. Refresh the dashboard then.</span>',
                'success'
            );
        } catch (e) {
            const msg = String(e.message || e);
            let hint = '';
            if (/401|403|Bad credentials|not accessible/i.test(msg)) {
                hint = '<br><span style="font-size:12px">Likely a bad / expired token, or the PAT does not have <code>Contents: write</code> on this repo.</span>';
            } else if (/sha/i.test(msg) && /does not match/i.test(msg)) {
                hint = '<br><span style="font-size:12px">The remote file changed since this build. Click <strong>Build new trades.json</strong> again to refresh, then re-publish.</span>';
            }
            pubStatus('Publish failed: ' + msg + hint, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = origLabel;
        }
    }

    document.getElementById('adminPublish').addEventListener('click', function () {
        if (!LAST_OUTPUT) { pubStatus('Build the new trades.json first.', 'error'); return; }
        publishToGitHub(LAST_OUTPUT);
    });

    /* ---------- Current dataset table ---------- */
    function renderCurrent() {
        const q = (document.getElementById('adminSearch').value || '').toLowerCase();
        const body = document.getElementById('adminCurrentBody');
        const filtered = CURRENT.trades.filter(function (t) {
            if (!q) return true;
            return (String(t.id) + ' ' + (t.symbol||'') + ' ' + (t.tag||'') + ' ' + t.timestamp).toLowerCase().indexOf(q) !== -1;
        }).slice().reverse(); // newest first

        body.innerHTML = filtered.slice(0, 200).map(function (t) {
            const date = new Date(t.timestamp).toLocaleString('en-US', { dateStyle: 'short' });
            const ptsClass = t.pts > 0 ? 'pos' : t.pts < 0 ? 'neg' : 'zero';
            return '<tr>'
                 + '<td>' + t.id + '</td>'
                 + '<td>' + date + '</td>'
                 + '<td>' + (t.symbol||'/ES') + '</td>'
                 + '<td>' + (t.side||'—') + '</td>'
                 + '<td>' + t.result + '</td>'
                 + '<td class="num ' + ptsClass + '">' + (t.pts>=0?'+':'') + t.pts.toFixed(2) + '</td>'
                 + '<td><span class="tag tag--' + (t.tag||'H3') + '">' + (t.tag||'H3') + '</span></td>'
                 + '<td><button class="admin-row-del" data-id="' + t.id + '">Remove</button></td>'
                 + '</tr>';
        }).join('');

        body.querySelectorAll('.admin-row-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const id = btn.dataset.id;
                if (confirm('Remove trade #' + id + ' from the staged dataset? (You\'ll still need to download + commit.)')) {
                    CURRENT.trades = CURRENT.trades.filter(function (t) { return String(t.id) !== String(id); });
                    renderCurrent(); renderKpis();
                    showOutput({
                        meta: CURRENT.meta,
                        trades: CURRENT.trades
                    });
                    status('Removed trade #' + id + ' — download the new trades.json to publish.', 'info');
                }
            });
        });

        if (filtered.length > 200) {
            body.insertAdjacentHTML('beforeend', '<tr><td colspan="8" style="text-align:center;color:var(--slate);font-size:12px;padding:12px">Showing 200 of ' + filtered.length + ' filtered trades. Refine search to narrow.</td></tr>');
        }
    }
    document.getElementById('adminSearch').addEventListener('input', renderCurrent);

})();
