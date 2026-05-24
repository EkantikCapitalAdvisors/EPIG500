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
        const pts = trades.map(function (t) { return t.pts; });
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

    function handleUpload(text, filename) {
        try {
            // 0. Discord HTML export — two flavors:
            //    (a) custom exporter with `const messages = [...]` embedded JSON
            //    (b) DiscordChatExporter DOM-based format
            const isHtml = (filename && /\.html?$/i.test(filename)) || /class=["']?chatlog__/i.test(text) || /const\s+messages\s*=\s*\[/.test(text);
            if (isHtml) {
                let journal = null;
                let source = '';
                // Try embedded JSON first — more reliable
                journal = customDiscordJsonToJournal(text);
                if (journal) source = 'embedded-JSON Discord export';
                else {
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
    // Per-line patterns. Prefix is any letter+word (M1, MO1, F1, MES, SPX, etc.)
    // Entry: starts with label, then s/b side letter, then price. Allows trailing inline SL/TP (parsed separately).
    const JOURNAL_ENTRY_RE  = /^\s*[A-Za-z]\w*\s*:\s*([sbSB])\s+(\d+(?:\.\d+)?)/;
    // Result: signed points required. Tag (H2/H3/BE) optional — defaults to H3 if absent.
    const JOURNAL_RESULT_RE = /^\s*[A-Za-z]\w*\s*:\s*([+-]\d+(?:\.\d+)?)(?:\s+([Hh][23]|BE|be))?\s*$/;
    const JOURNAL_SL_RE     = /\bsl\s*(\d+(?:\.\d+)?)/i;  // unanchored so it matches inline too
    const JOURNAL_TP_RE     = /\btp\s*(\d+(?:\.\d+)?)/i;

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
        let resultIndex = 0;        // for nudging timestamps when many results share a time

        const isOptions = currentStrategy() === 'options';
        const dollarMult = isOptions ? 1 : 50;
        const sym = defaultSymbol();

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
                continue;
            }
            // Standalone SL/TP lines (label-prefixed): only fire if the line starts with a label
            if (/^\s*[A-Za-z]\w*\s*:/.test(trimmed)) {
                const sl = trimmed.match(JOURNAL_SL_RE);
                if (sl && !em) { pendingSl = parseFloat(sl[1]); continue; }
                const tp = trimmed.match(JOURNAL_TP_RE);
                if (tp && !em) { pendingTp = parseFloat(tp[1]); continue; }
            }

            const rm = trimmed.match(JOURNAL_RESULT_RE);
            if (rm) {
                const pts = parseFloat(rm[1]);
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

                trades.push({
                    timestamp: tradeDate.toISOString(),
                    symbol: sym,
                    side: pendingEntry ? pendingEntry.side : '',
                    result: pts > 0 ? 'W' : pts < 0 ? 'L' : 'BE',
                    pts: Math.round(pts * 100) / 100,
                    dollars: Math.round(pts * dollarMult * 100) / 100,
                    tag: tag,
                    period: 'pre_reg',
                    strategy: currentStrategy(),
                    entry: pendingEntry ? pendingEntry.entry : null,
                    sl: pendingSl,
                    tp: pendingTp
                });

                // Reset trade context — next result starts fresh
                pendingEntry = null;
                pendingSl = null;
                pendingTp = null;
                continue;
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
        body.innerHTML = STAGED.map(function (t, idx) {
            const date = new Date(t.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
            const ptsClass = t.pts > 0 ? 'pos' : t.pts < 0 ? 'neg' : 'zero';
            return '<tr>'
                 + '<td>' + (idx+1) + '</td>'
                 + '<td>' + date + '</td>'
                 + '<td>' + (t.symbol||'/ES') + '</td>'
                 + '<td>' + (t.side||'—') + '</td>'
                 + '<td>' + t.result + '</td>'
                 + '<td class="num ' + ptsClass + '">' + (t.pts>=0?'+':'') + t.pts.toFixed(2) + '</td>'
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
        merged.forEach(function (t, i) { t.id = i + 1; });

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
        const wins = json.trades.filter(function (t) { return t.pts > 0; }).length;
        const losses = json.trades.filter(function (t) { return t.pts < 0; }).length;
        const total = json.trades.reduce(function (a, t) { return a + t.pts; }, 0);
        document.getElementById('adminOutputStats').innerHTML =
              '<div><em>Trades</em><strong>' + json.trades.length + '</strong></div>'
            + '<div><em>W / L</em><strong>' + wins + ' / ' + losses + '</strong></div>'
            + '<div><em>Total pts</em><strong>' + (total>=0?'+':'') + total.toFixed(0) + '</strong></div>';
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
