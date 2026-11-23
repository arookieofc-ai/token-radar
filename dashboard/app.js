// Token Radar dashboard: renders window.RADAR (written by main.ts as data.js)
// with no network. Routes: #/board?category=&chain=&q=&watch=&sort=&dir=&tab=
// and #/protocol/<slug>. Filters live in the hash so a filtered view loads
// directly. The page re-derives each row's implied value and farm plan from
// the same inputs main.ts writes, so the code and the board visibly agree.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var app = document.getElementById('app');
  if (!DATA || !app) return;
  var MODEL = DATA.model;

  function esc(s) { return String(s); }
  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  function mult(x) { return x.toFixed(2) + 'x'; }

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
      else if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  }

  // The model in one function: TVL x multiple x growth x maturity x breadth.
  function impliedOf(r) {
    var g = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, (typeof r.change_7d === 'number' ? r.change_7d : 0)));
    var gm = 1 + (g / 100) * MODEL.growth_weight;
    var a = (r.age_days === null || r.age_days === undefined) ? MODEL.unknown_age_days : r.age_days;
    var mm = MODEL.maturity_floor + (Math.min(Math.max(a, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
    var bm = 1 + MODEL.breadth_step * Math.min(Math.max(r.chains.length - 1, 0), MODEL.breadth_max_steps);
    return Math.max(1, Math.round(r.tvl_usd * r.multiple_used * gm * mm * bm));
  }

  // The farm plan derivation, mirroring lib/model.ts: category, chains, TVL
  // and age decide the action, the capital, the hold and every cost and time.
  function capFor(tvl) {
    if (tvl >= 5e9) return 250;
    if (tvl >= 1e9) return 150;
    if (tvl >= 1e8) return 100;
    return 50;
  }
  function holdFor(a) {
    if (a === null || a === undefined) return 30;
    if (a < 180) return 60;
    if (a < 365) return 45;
    return 30;
  }
  function coreAction(r, cap, chain) {
    var c = (r.category || '').toLowerCase(), name = r.name;
    if (/lend|cdp|collateral|borrow/.test(c)) return 'Supply $' + cap + ' of USDC to ' + name + "'s lending market on " + chain + ' through its app Supply tab, then borrow 10% of it and repay half to leave both legs on record.';
    if (/curator|allocator|curation/.test(c)) return 'Deposit $' + cap + ' of USDC into a ' + name + ' curator vault on ' + chain + ' through its app Vaults page and keep the vault shares in your wallet.';
    if (/rwa|treasury|credit|prime/.test(c)) return 'Complete ' + name + "'s onboarding on " + chain + ', mint $' + cap + ' of its yield-bearing asset and hold it in the farming wallet.';
    if (/dex|swap|amm|liquidity manager/.test(c)) return 'Provide $' + cap + ' of two-sided liquidity to ' + name + "'s main pool on " + chain + ' through its app Pools page, keep the LP position in range for the full hold.';
    if (/perpetual|derivative|basis|leveraged/.test(c)) return 'Deposit $' + cap + ' of USDC as margin on ' + name + ' on ' + chain + ', open one small long and one small short so both sides print volume, then close them the same week.';
    if (/yield|farm|aggregator|vault/.test(c)) return 'Deposit $' + cap + ' of USDC into ' + name + "'s flagship yield vault on " + chain + ' through its app Earn page and leave it compounding for the full hold.';
    if (/bridge|canonical|gateway|cross chain/.test(c)) return 'Bridge $' + cap + ' of USDC into ' + chain + ' through ' + name + "'s own bridge interface, then supply the bridged funds once in the destination app so the receipt is used, not parked.";
    if (/stak|restak|pool|validator/.test(c)) return 'Stake $' + cap + " of the chain's staking asset through " + name + ' on ' + chain + ' using its app Stake page and keep the liquid receipt token in your wallet.';
    if (/prediction/.test(c)) return 'Fund ' + name + ' on ' + chain + ' with $' + cap + ' and place one YES and one NO position in its most liquid market so both sides settle on record.';
    if (/stable|wrapper|locker/.test(c)) return 'Mint $' + cap + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it in the farming wallet for the full hold.';
    if (/payment|chain|network/.test(c)) return 'Bridge $' + cap + ' of USDC to ' + name + "'s network on " + chain + ' and run two transactions a week in its flagship app (swap, transfer or quest) so the address is active.';
    if (/insurance/.test(c)) return 'Buy $' + cap + ' of cover from ' + name + ' on ' + chain + ' through its app Cover page and keep the policy for the full hold.';
    if (/option|interest rate/.test(c)) return 'Deposit $' + cap + ' of USDC into ' + name + "'s options or rate vault on " + chain + ' through its app and keep the position to expiry week.';
    if (/index|basket|token set/.test(c)) return 'Mint $' + cap + ' of ' + name + "'s index token on " + chain + ' through its app and hold it for the full hold.';
    return 'Deposit $' + cap + ' of USDC into ' + name + ' on ' + chain + ' through its official app and keep the position open for the full hold.';
  }
  function recurAction(r) {
    var c = (r.category || '').toLowerCase();
    if (/lend|cdp|collateral|borrow/.test(c)) return 'Each week, adjust the position once: top up $10 of supply, toggle part of the borrow, or claim and re-supply any rewards.';
    if (/dex|swap|amm/.test(c)) return 'Each week, collect and re-add $5 of fees to the pool position, and run one $10 swap through the same pool.';
    if (/perpetual|derivative|basis/.test(c)) return 'Each week, open and close one small hedged trade pair so weekly volume prints without directional risk.';
    if (/bridge|canonical|gateway|cross chain/.test(c)) return 'Each week, bridge $10 back or forth through the protocol so more than one week shows bridge volume.';
    if (/stak|restak|pool/.test(c)) return 'Each week, restake $5 of staking rewards through the same receipt so compounding events accumulate on record.';
    if (/prediction/.test(c)) return 'Each week, settle or roll one market position and open the next week’s position in the most liquid market.';
    return 'Each week, perform one qualifying action in the app: a $10 deposit, a swap, a vote, or a rewards claim.';
  }
  function farmFor(r) {
    var chain = r.chains.length ? r.chains[0] : 'its main chain';
    var second = r.chains.length > 1 ? r.chains[1] : null;
    var cap = capFor(r.tvl_usd), hold = holdFor(r.age_days), gas = cap >= 150 ? 8 : 4;
    function s(text, cost, time) {
      var full = text + ' Cost: ' + cost + '. Time: ' + time + '.';
      return full.length > 600 ? full.slice(0, 596) + '...' : full;
    }
    return [
      s('Create a fresh wallet that holds only farm funds, fund it with $' + cap + ' plus about $15 of the ' + chain + ' gas token, and store the seed phrase offline.', 'about $3 of gas for funding', '10 minutes to set up'),
      s(coreAction(r, cap, chain), '$' + cap + ' of capital and about $' + gas + ' of gas', '15 minutes to set up'),
      s(recurAction(r), 'about $2 of gas a week', '10 minutes a week'),
      s(second !== null
        ? 'Repeat the core position once on ' + second + ' so the same wallet shows activity on two of the protocol’s chains, then hold every position for at least ' + hold + ' days to span more than one snapshot.'
        : 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot, and never fully withdraw between weekly actions.',
        second !== null ? 'an extra $25 of capital and about $3 of gas on ' + second : 'the $' + cap + ' stays in the position', hold + ' days across snapshots'),
      s('Before you unwind, open the protocol’s own points or rewards page from its official site, confirm your wallet’s score, and claim only through the link it publishes.', 'no fee to check, never pay to claim', '10 minutes to verify'),
      s('Log the wallet address, each transaction hash and the dates in a farm journal so you can repeat the position or unwind it after any token event.', 'nothing but the log', '5 minutes per entry')
    ];
  }

  function route() {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('/protocol/') === 0) {
      return { view: 'detail', slug: decodeURIComponent(h.slice(10).split('?')[0]) };
    }
    var q = '', m = h.match(/\?(.*)$/);
    if (m) q = m[1]; else if (h.charAt(0) === '?') q = h.slice(1);
    var p = new URLSearchParams(q);
    var sort = p.get('sort') || 'rank';
    var dp = p.get('dir');
    return {
      view: 'board', q: p.get('q') || '', category: p.get('category') || '',
      chain: p.get('chain') || '', watch: p.get('watch') === '1',
      sort: DEFDIR[sort] === undefined ? 'rank' : sort,
      dir: dp ? (dp === '1' ? 1 : -1) : (DEFDIR[sort] === undefined ? 1 : DEFDIR[sort]),
      tab: p.get('tab') || 'pre'
    };
  }
  function boardHref(s) {
    var p = new URLSearchParams();
    if (s.tab === 'live') p.set('tab', 'live');
    if (s.q) p.set('q', s.q);
    if (s.category) p.set('category', s.category);
    if (s.chain) p.set('chain', s.chain);
    if (s.watch) p.set('watch', '1');
    if (s.sort && s.sort !== 'rank') p.set('sort', s.sort);
    if (s.dir !== (DEFDIR[s.sort || 'rank'] === undefined ? 1 : DEFDIR[s.sort || 'rank'])) p.set('dir', s.dir === 1 ? '1' : '-1');
    var qs = p.toString();
    return '#/board' + (qs ? '?' + qs : '');
  }

  var CATS = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorized'; }))).sort();
  var CHAINS = (function () {
    var n = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { n[c] = (n[c] || 0) + 1; }); });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).slice(0, 14);
  })();
  var lastBoard = '#/board';

  function filtered(st) {
    var q = st.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (st.category && (r.category || 'Uncategorized') !== st.category) return false;
      if (st.chain && r.chains.indexOf(st.chain) < 0) return false;
      if (st.watch && !r.watchlisted) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, r.chains.join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  var DEFDIR = { rank: 1, name: 1, category: 1, tvl: -1, growth: -1, age: -1, implied: -1, perx: -1 };
  function val(r, k) {
    if (k === 'rank') return r.rank;
    if (k === 'name') return r.name.toLowerCase();
    if (k === 'category') return (r.category || 'Uncategorized').toLowerCase();
    if (k === 'tvl') return r.tvl_usd;
    if (k === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
    if (k === 'age') return r.age_days === null ? Infinity : r.age_days;
    if (k === 'perx') return r.implied_value_usd / Math.max(1, r.tvl_usd);
    return r.implied_value_usd;
  }
  function sorted(list, st) {
    var k = DEFDIR[st.sort] === undefined ? 'rank' : st.sort;
    return list.slice().sort(function (a, b) {
      var av = val(a, k), bv = val(b, k);
      if (av < bv) return -st.dir;
      if (av > bv) return st.dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function header() {
    return el('div', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'dot' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'meta' },
        el('span', { text: 'snapshot ' + DATA.as_of }),
        el('span', { text: 'floor $' + Math.round(DATA.floor_usd / 1e6) + 'M' }),
        el('span', { text: DATA.model_version }))
    );
  }
  function lede(st) {
    return el('div', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: ' + DATA.watchlist_size + ' protocols with $50M+ TVL and no token on record. Below it, ' + DATA.early_size + ' early finds. Implied value is a comparables estimate — TVL times the market multiple — not a promise.' }),
        el('div', { class: 'tabs' },
          el('a', { href: boardHref(Object.assign({}, st, { tab: 'pre' })), 'aria-current': st.tab === 'pre' ? 'true' : null, text: 'Pre-token' }),
          el('a', { href: boardHref(Object.assign({}, st, { tab: 'live' })), 'aria-current': st.tab === 'live' ? 'true' : null, text: 'Live token (' + DATA.live_size + ')' }))
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Board rows' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: usd(DATA.rows[0].implied_value_usd) })))
    );
  }

  function paintListShell(st, mount) {
    var list = sorted(filtered(st), st);
    var max = 1;
    DATA.rows.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    function th(key, label) {
      var active = st.sort === key;
      return el('th', { scope: 'col' },
        el('button', {
          type: 'button',
          'aria-label': 'Sort by ' + label,
          onclick: function () {
            var ns = Object.assign({}, st);
            if (ns.sort === key) ns.dir = -ns.dir;
            else { ns.sort = key; ns.dir = DEFDIR[key]; }
            location.hash = boardHref(ns);
          }
        }, label, active ? el('span', { text: st.dir < 0 ? ' ▼' : ' ▲' }) : null));
    }
    var head = el('thead', null, el('tr', null,
      th('rank', 'Rank'), th('name', 'Protocol'), th('category', 'Category'),
      th('tvl', 'TVL'), th('growth', '7d'), th('implied', 'Implied value'),
      th('perx', 'Impl/TVL'), el('th', { scope: 'col', text: 'Board' })));
    var body = el('tbody');
    list.forEach(function (r) {
      var g = r.change_7d === null ? 'n/a' : pct(r.change_7d);
      var gc = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'up' : 'dn');
      body.appendChild(el('tr', {
        class: 'row', tabindex: '0',
        onclick: function () { location.hash = '#/protocol/' + r.slug; },
        onkeydown: function (e) { if (e.key === 'Enter') location.hash = '#/protocol/' + r.slug; }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }),
          el('span', { text: (r.chains.slice(0, 2).join(', ') || 'single chain') + ' · ' + r.slug }))),
        el('td', { text: r.category || 'Uncategorized' }),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + gc, text: g }),
        el('td', null, el('div', { class: 'impl' },
          el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: usd(r.implied_value_usd) }))),
        el('td', { class: 'num', text: mult(r.implied_value_usd / Math.max(1, r.tvl_usd)) }),
        el('td', null, r.watchlisted ? el('span', { class: 'badge', text: 'WATCH' }) : el('span', { class: 'badge dim', text: 'EARLY' }))));
    });
    mount.textContent = '';
    if (!list.length) {
      mount.appendChild(el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain.' }),
        el('button', { class: 'btn solid', type: 'button', text: 'Clear filters', onclick: function () { location.hash = '#/board'; } })));
      return { count: 0 };
    }
    mount.appendChild(el('div', { class: 'tw' }, el('table', null,
      el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model maths and farm plan.' }), head, body)));
    return { count: list.length };
  }

  function method() {
    var m = MODEL;
    var rows = DATA.multiples.map(function (t) {
      return el('tr', null,
        el('td', { text: t.category }),
        el('td', { class: 'num', text: String(t.peers) }),
        el('td', { class: 'num', text: t.median.toFixed(4) }),
        el('td', { class: 'num', text: t.used.toFixed(4) + (t.fallback ? ' *' : '') }));
    });
    return el('section', { class: 'panel method' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Each pre-token protocol is priced like its tokened peers: its TVL times the median market-cap-to-TVL multiple of its category. Categories with fewer than ' + m.min_peers + ' tokened peers (marked *) use the global median of ' + DATA.global_median.toFixed(4) + '. That base is then adjusted by three bounded factors — 7-day TVL momentum, maturity (days listed with no token), and chain breadth — so no single input can dominate.' }),
      el('div', { class: 'formula', text: 'implied = round( TVL × multiple × (1 + clamp(7d, ' + m.growth_floor + ', ' + m.growth_cap + ')/100 × ' + m.growth_weight + ') × (' + m.maturity_floor + ' + min(age,' + m.maturity_days + ')/' + m.maturity_days + ' × ' + m.maturity_range + ') × (1 + ' + m.breadth_step + ' × min(chains−1,' + m.breadth_max_steps + ')) )' }),
      el('p', { text: 'Tokened protocols are never ranked: the ' + DATA.live_size + ' largest trade under the Live token tab at their market caps. Exchanges and versioned pools are left out everywhere, and wrapped, bridged or staked claims are left out above the floor — each is a claim on an asset that already trades.' }),
      el('div', { class: 'tw' }, el('table', { class: 'mult' },
        el('caption', { text: 'Category multiples from the snapshot’s tokened protocols (mcap/TVL).' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Peers' }), el('th', { scope: 'col', text: 'Median' }), el('th', { scope: 'col', text: 'Multiple used' }))),
        el('tbody', null, rows))));
  }

  function boardView(st) {
    lastBoard = boardHref(st);
    var shell = el('div', { class: 'wrap' });
    shell.appendChild(header());
    shell.appendChild(lede(st));
    // Filters
    var search = el('input', { type: 'search', value: st.q, placeholder: 'Search name, slug, category, chain', 'aria-label': 'Search the board' });
    var catSel = el('select', { 'aria-label': 'Filter by category' },
      el('option', { value: '', text: 'All categories' }),
      CATS.map(function (c) { return el('option', { value: c, text: c }); }));
    catSel.value = st.category;
    var chainSel = el('select', { 'aria-label': 'Filter by chain' },
      el('option', { value: '', text: 'All chains' }),
      CHAINS.map(function (c) { return el('option', { value: c, text: c }); }));
    chainSel.value = st.chain;
    var watchBox = el('input', { type: 'checkbox', 'aria-label': 'Watchlist only' });
    watchBox.checked = st.watch;
    var count = el('span', { class: 'count' });
    function go(ns) { location.hash = boardHref(ns); }
    search.addEventListener('input', function () {
      st.q = search.value;
      history.replaceState(null, '', boardHref(st));
      paint();
    });
    catSel.addEventListener('change', function () { go(Object.assign({}, st, { category: catSel.value })); });
    chainSel.addEventListener('change', function () { go(Object.assign({}, st, { chain: chainSel.value })); });
    watchBox.addEventListener('change', function () { go(Object.assign({}, st, { watch: watchBox.checked })); });
    shell.appendChild(el('div', { class: 'filters' },
      el('div', { class: 'field' }, el('label', { text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('span', { class: 'lbl', text: 'Scope' }),
        el('label', { class: 'check' }, watchBox, el('span', { text: 'Watchlist only' }))),
      count));
    var listMount = el('div');
    function paint() {
      var r = paintListShell(st, listMount);
      count.textContent = st.tab === 'live' ? DATA.live.length + ' live-token protocols' : r.count + ' of ' + DATA.board_size + ' rows shown';
    }
    if (st.tab === 'live') {
      var lb = el('tbody');
      DATA.live.forEach(function (r) {
        lb.appendChild(el('tr', null,
          el('td', { class: 'num', text: 'live' }),
          el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { text: (r.chains.slice(0, 2).join(', ') || 'single chain') + ' · ' + (r.category || 'Uncategorized') }))),
          el('td', { class: 'num', text: usd(r.tvl_usd) }),
          el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d < 0 ? 'dn' : 'up'), text: pct(r.change_7d) }),
          el('td', { class: 'num', text: usd(r.mcap_usd) }),
          el('td', null, el('span', { class: 'badge dim', text: 'TRADES' }))));
      });
      listMount.appendChild(el('div', { class: 'tw' }, el('table', null,
        el('caption', { text: 'Already trading: market capitalisation is a fact, not a model. Never ranked with the pre-token board.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
        lb)));
      count.textContent = DATA.live.length + ' live-token protocols';
    } else {
      paint();
    }
    shell.appendChild(listMount);
    if (st.tab === 'pre') shell.appendChild(method());
    shell.appendChild(el('div', { class: 'foot' },
      el('span', { text: 'Source: ' + DATA.source }),
      el('span', { text: 'Model ' + DATA.model_version + ' · deterministic: two runs print byte-identical files.' })));
    return shell;
  }

  function detailView(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var shell = el('div', { class: 'wrap' });
    shell.appendChild(header());
    if (!r) {
      shell.appendChild(el('div', { class: 'detail-head' }, el('div', null,
        el('a', { class: 'back', href: lastBoard, text: '← Back to the board' }),
        el('h1', { text: 'Unknown protocol' }),
        el('p', { class: 'sub', text: 'No board row carries the slug “' + slug + '”.' }))));
      return shell;
    }
    var recomputed = impliedOf(r);
    var match = Math.abs(recomputed - r.implied_value_usd) <= Math.max(1000, r.implied_value_usd * 0.005);
    shell.appendChild(el('div', { class: 'detail-head' }, el('div', null,
      el('a', { class: 'back', href: lastBoard, text: '← Back to the board' }),
      el('h1', { text: 'Rank ' + r.rank + ' · ' + r.name }),
      el('p', { class: 'sub', text: (r.category || 'Uncategorized') + ' on ' + (r.chains.join(', ') || 'an unnamed chain') }),
      el('div', { class: 'tags' },
        el('span', { class: 'badge', text: 'NO TOKEN ON RECORD' }),
        r.watchlisted ? el('span', { class: 'badge', text: 'WATCHLIST' }) : el('span', { class: 'badge dim', text: 'EARLY FIND' })))));
    shell.appendChild(el('div', { class: 'grid' },
      el('div', { class: 'stat' }, el('span', { text: 'TVL' }), el('b', { text: usd(r.tvl_usd) })),
      el('div', { class: 'stat' }, el('span', { text: '7-day change' }), el('b', { class: r.change_7d !== null && r.change_7d < 0 ? 'dn' : 'up', text: pct(r.change_7d) })),
      el('div', { class: 'stat' }, el('span', { text: 'Age, no token' }), el('b', { text: age(r.age_days) + (r.listed_at ? ' · ' + r.listed_at : '') })),
      el('div', { class: 'stat' }, el('span', { text: 'Chains' }), el('b', { text: String(r.chains.length) }))));
    shell.appendChild(el('section', { class: 'panel math' },
      el('h2', { text: 'Model breakdown' }),
      el('div', { class: 'eq' },
        el('div', null, el('span', { text: 'TVL (snapshot)' }), el('b', { text: usd(r.tvl_usd) })),
        el('div', null, el('span', { text: 'Multiple (' + r.multiple_source + ')' }), el('b', { text: r.multiple_used.toFixed(4) + '×' })),
        el('div', null, el('span', { text: 'Growth ' + pct(r.growth_pct) + ' (½ weight)' }), el('b', { text: r.growth_multiplier.toFixed(4) + '×' })),
        el('div', null, el('span', { text: 'Maturity (' + age(r.age_days) + ' listed, no token)' }), el('b', { text: r.maturity_multiplier.toFixed(4) + '×' })),
        el('div', null, el('span', { text: 'Breadth (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')' }), el('b', { text: r.breadth_multiplier.toFixed(4) + '×' })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { text: usd(r.implied_value_usd) + ' (' + mult(r.implied_value_usd / Math.max(1, r.tvl_usd)) + ' of TVL)' }))),
      el('p', { class: 'cost', text: 'The page recomputes ' + usd(recomputed) + (match ? ' — the same number board.json carries.' : ' — off the board’s number; the data would be stale.') + ' An estimate, never a price.' })));
    var steps = farmFor(r).map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return el('li', null, el('div', { class: 'checkline' }, el('div', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }))));
    });
    shell.appendChild(el('section', { class: 'panel math' },
      el('h2', { text: 'Farm plan' }),
      el('p', { class: 'cost', text: 'Six steps for ' + r.name + ' on ' + (r.chains[0] || 'its main chain') + ' — every step names what it costs and how long it takes.' }),
      el('ol', { class: 'steps' }, steps)));
    return shell;
  }

  function render() {
    var st = route();
    app.textContent = '';
    app.appendChild(st.view === 'detail' ? detailView(st.slug) : boardView(st));
  }
  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', '#/board');
  render();
})();
