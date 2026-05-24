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

    /* ---------- Tabs ---------- */
    const tabs = document.querySelectorAll('.admin-tab');
    const panels = document.querySelectorAll('.admin-panel__body');
    tabs.forEach(function (t) {
        t.addEventListener('click', function () {
            tabs.forEach(function (x) { x.classList.toggle('is-active', x === t); });
            panels.forEach(function (p) { p.hidden = p.dataset.panel !== t.dataset.mode; });
        });
    });

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
                tag: tagKey && r[tagKey] ? String(r[tagKey]).toUpperCase() : (pts === 0 ? 'BE' : 'H3')
            });
        }
        return out;
    }

    function handleUpload(text, filename) {
        try {
            // 1. Ekantik journal format detection (date + MO1:s/b/sl/tp + result line)
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
    const JOURNAL_DATE_RE   = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2})[.:](\d{2})\s*(AM|PM|am|pm)?\b/;
    const JOURNAL_ENTRY_RE  = /^\s*M\w*\s*:\s*([sbSB])\s*(\d+(?:\.\d+)?)/m;
    const JOURNAL_RESULT_RE = /^\s*M\w*\s*:\s*([+-]\d+(?:\.\d+)?)\s+([Hh][23]|BE|be)/m;

    function looksLikeJournal(text) {
        return JOURNAL_DATE_RE.test(text) && JOURNAL_RESULT_RE.test(text);
    }

    function parseEkantikJournal(text) {
        // Split into blocks. A block boundary is any line that itself is a date header.
        const lines = text.split(/\r?\n/);
        const blocks = [];
        let buf = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (JOURNAL_DATE_RE.test(line.trim()) && buf.length > 0) {
                blocks.push(buf.join('\n'));
                buf = [line];
            } else {
                buf.push(line);
            }
        }
        if (buf.join('').trim().length) blocks.push(buf.join('\n'));

        const trades = [];
        for (let bi = 0; bi < blocks.length; bi++) {
            const block = blocks[bi];
            const dm = block.match(JOURNAL_DATE_RE);
            const rm = block.match(JOURNAL_RESULT_RE);
            if (!dm || !rm) continue;

            // Date / time
            let mo = parseInt(dm[1], 10);
            let day = parseInt(dm[2], 10);
            let yr = parseInt(dm[3], 10);
            if (yr < 100) yr += 2000;
            let hr = parseInt(dm[4], 10);
            const min = parseInt(dm[5], 10);
            const ampm = (dm[6] || '').toUpperCase();
            if (ampm === 'PM' && hr < 12) hr += 12;
            if (ampm === 'AM' && hr === 12) hr = 0;
            const ts = new Date(yr, mo - 1, day, hr, min, 0).toISOString();

            // Entry (optional)
            const em = block.match(JOURNAL_ENTRY_RE);
            const side = em ? (em[1].toLowerCase() === 's' ? 'SHORT' : 'LONG') : '';
            const entry = em ? parseFloat(em[2]) : null;

            // Stop loss / trailing profit (optional, captured for the record)
            const slMatch = block.match(/^\s*M\w*\s*:\s*sl\s*(\d+(?:\.\d+)?)/im);
            const tpMatch = block.match(/^\s*M\w*\s*:\s*tp\s*(\d+(?:\.\d+)?)/im);

            // Result
            const pts = parseFloat(rm[1]);
            let tag = rm[2].toUpperCase();
            if (tag === 'H1') tag = 'H3'; // OP-04: per-trade H1 is itself a breach

            trades.push({
                timestamp: ts,
                symbol: '/ES',
                side: side,
                result: pts > 0 ? 'W' : pts < 0 ? 'L' : 'BE',
                pts: Math.round(pts * 100) / 100,
                dollars: Math.round(pts * 50 * 100) / 100,
                tag: tag,
                entry: entry,
                sl: slMatch ? parseFloat(slMatch[1]) : null,
                tp: tpMatch ? parseFloat(tpMatch[1]) : null
            });
        }
        return trades;
    }

    document.getElementById('adminFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const fr = new FileReader();
        fr.onload = function () { handleUpload(fr.result, f.name); };
        fr.readAsText(f);
    });
    const drop = document.querySelector('.upload-drop');
    ['dragenter','dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-dragover'); }); });
    ['dragleave','drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); }); });
    drop.addEventListener('drop', function (e) {
        const f = e.dataTransfer.files[0]; if (!f) return;
        const fr = new FileReader();
        fr.onload = function () { handleUpload(fr.result, f.name); };
        fr.readAsText(f);
    });
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
            tag: (fd.get('tag') || 'H3').toString()
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
