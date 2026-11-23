// Repo tooling (never shipped). Asserts every gate rule against an output dir:
// dashboard files, board file, sort order, watchlist coverage, farm steps,
// screenshots, and dossier byte-identity. Run: `node tools/check.mjs [outdir]`.
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const out = process.argv[2] ?? join(new URL('.', import.meta.url).pathname, '..', 'out');
const snap = JSON.parse(readFileSync(join(new URL('.', import.meta.url).pathname, '..', 'input', 'snapshot.json'), 'utf8'));
const failures = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures.push(name);
};
const NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

// ---- dashboard files ----
{
  const root = join(out, 'dashboard');
  const files = [];
  let bytes = 0;
  const stack = [''];
  let dotDir = null, badName = null, nonFile = null;
  while (stack.length) {
    const rel = stack.pop();
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) { if (e.name.startsWith('.')) dotDir = p; else stack.push(p); }
      else if (e.isFile()) {
        if (!NAME.test(e.name)) badName = p;
        const s = lstatSync(join(root, p)).size;
        files.push(p); bytes += s;
      } else nonFile = p;
    }
  }
  const hasHtml = files.some((f) => f === 'index.html' || f.endsWith('/index.html'));
  const hasCss = files.some((f) => f.endsWith('.css'));
  const hasJs = files.some((f) => f.endsWith('.js'));
  ok('dashboard_files', files.length >= 3 && files.length <= 400 && bytes <= 4 * 194304 &&
    hasHtml && hasCss && hasJs && !dotDir && !badName && !nonFile,
    `${files.length} files, ${bytes} bytes`);
  // No http(s) in HTML attribute values, style bodies, CSS files, or JS imports.
  let leak = null;
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8');
    if (f.endsWith('.css') && /https?:\/\//.test(src)) { leak = `${f}: url in css`; break; }
    if (f.endsWith('.html')) {
      const noComments = src.replace(/<!--[\s\S]*?-->/g, '');
      const attrs = [...noComments.matchAll(/[a-zA-Z-]+="([^"]*)"/g)];
      if (attrs.some((m) => /https?:\/\//.test(m[1]))) { leak = `${f}: url in attribute`; break; }
      const styles = [...noComments.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
      if (styles.some((m) => /https?:\/\//.test(m[1]))) { leak = `${f}: url in style`; break; }
      const inlineImports = [...noComments.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
      if (inlineImports.some((m) => /(import\s*[( '"]|export\s+[^;]*?from\s*['"]|require\s*\()/i.test(m[1]))) { leak = `${f}: import in inline script`; break; }
    }
    if (f.endsWith('.js') && /(import\s+(?:[^'"]*?\sfrom\s*)?['"]https?:|export\s+[^;]*?from\s*['"]https?:|import\s*\(\s*['"]https?:|require\s*\(\s*['"]https?:)/.test(src)) {
      leak = `${f}: url in js import`; break;
    }
  }
  ok('dashboard_no_network_refs', leak === null, leak ?? 'no http(s) in attrs/css/imports');
  ok('dashboard_source_under_60k', bytes <= 60 * 1024, `${bytes} bytes`);
}

// ---- board file ----
const boardPath = join(out, 'board.json');
const raw = readFileSync(boardPath);
const parsed = JSON.parse(raw.toString('utf8'));
const rows = Array.isArray(parsed) ? parsed : parsed.rows;
const slugs = new Set(snap.protocols.map((p) => p.slug));
ok('board_file', raw.length <= 8 * 1024 * 1024 && rows.length >= 100 && rows.length <= 4000 &&
  rows.every((r) => slugs.has(r.slug) && typeof r.name === 'string' && r.name.length > 0 &&
    Number.isSafeInteger(r.rank) && r.rank > 0 && Number.isSafeInteger(r.implied_value_usd) &&
    r.implied_value_usd > 0 && r.implied_value_usd <= 100_000_000_000_000 && Array.isArray(r.farm_steps)),
  `${rows.length} rows, ${raw.length} bytes`);

// ---- sorted by value ----
{
  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  const ranksOk = ranks.every((v, i) => v === i + 1);
  const orderOk = rows.every((r, i) => i === 0 || rows[i - 1].implied_value_usd >= r.implied_value_usd);
  const varied = !(rows.length >= 2 && rows.every((r) => r.implied_value_usd === rows[0].implied_value_usd));
  ok('sorted_by_value', ranksOk && orderOk && varied, `ranks 1..${rows.length}${ranksOk ? '' : ' BROKEN'}, non-increasing: ${orderOk}`);
}

// ---- coverage ----
{
  const have = new Set(rows.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !have.has(s));
  ok('coverage', missing.length === 0, `${snap.watchlist.length} watchlist slugs, missing: ${missing.slice(0, 3).join(', ') || 'none'}`);
}

// ---- farm steps ----
{
  const bad = rows.find((r) => !(r.farm_steps.length >= 3 && r.farm_steps.length <= 12 &&
    r.farm_steps.every((s) => typeof s === 'string' && s.trim().length >= 20 && s.trim().length <= 600)));
  ok('farm_steps', bad === undefined, bad ? `${bad.slug} has a bad step` : `${rows.length} rows x ${rows[0].farm_steps.length} steps, all 20..600 chars`);
}

// ---- screenshots ----
function pngSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: 'png' };
  return null;
}
function jpegSize(b) {
  if (!(b.length > 2 && b[0] === 0xff && b[1] === 0xd8)) return null;
  let i = 2;
  while (i + 8 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: 'jpeg' };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
{
  const dir = join(out, 'screenshots');
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  ok('screenshots_count', names.length >= 3 && names.length <= 4, names.join(', '));
  let shotsOk = true, detail = [];
  for (const n of names) {
    const p = join(dir, n);
    const st = lstatSync(p);
    const b = readFileSync(p);
    const dim = pngSize(b) ?? jpegSize(b);
    const long = dim ? Math.max(dim.w, dim.h) : -1;
    const short = dim ? Math.min(dim.w, dim.h) : -1;
    const good = st.isFile() && NAME.test(n) && st.size <= 524288 && dim !== null && long <= 1440 && short >= 800;
    if (!good) shotsOk = false;
    detail.push(`${n} ${(st.size / 1024).toFixed(0)}K ${dim ? `${dim.w}x${dim.h}` : 'NOT-AN-IMAGE'}`);
  }
  ok('screenshots', shotsOk, detail.join(' · '));
}

// ---- dossier matches ----
{
  const mine = readFileSync(join(out, 'dossier.json'));
  const rebuilt = Buffer.from(buildDossier(out, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } }));
  ok('dossier_matches', Buffer.compare(mine, rebuilt) === 0, `${mine.length} bytes`);
}

// ---- model/data agreement: recompute implied from data.js inputs ----
{
  const dataJs = readFileSync(join(out, 'data.js'), 'utf8');
  const m = dataJs.match(/^window\.RADAR=(\{.*\});\n?$/s);
  const radar = JSON.parse(m[1]);
  const mdl = radar.model;
  let worst = 0, bad = 0;
  for (const r of radar.rows) {
    const g = Math.min(mdl.growth_cap, Math.max(mdl.growth_floor, r.change_7d ?? 0));
    const gm = 1 + (g / 100) * mdl.growth_weight;
    const a = r.age_days ?? mdl.unknown_age_days;
    const mm = mdl.maturity_floor + (Math.min(Math.max(a, 0), mdl.maturity_days) / mdl.maturity_days) * mdl.maturity_range;
    const bm = 1 + mdl.breadth_step * Math.min(Math.max(r.chains.length - 1, 0), mdl.breadth_max_steps);
    const re = Math.max(1, Math.round(r.tvl_usd * r.multiple_used * gm * mm * bm));
    const d = Math.abs(re - r.implied_value_usd);
    worst = Math.max(worst, d);
    if (d > Math.max(2, r.implied_value_usd * 0.001)) bad++;
  }
  const boardBySlug = new Map(rows.map((r) => [r.slug, r.implied_value_usd]));
  const mismatch = radar.rows.filter((r) => boardBySlug.get(r.slug) !== r.implied_value_usd).length;
  ok('data_agrees_with_board', bad === 0 && mismatch === 0, `worst recompute diff $${worst}, cross-file mismatches: ${mismatch}`);
}

if (failures.length) {
  console.error(`\n${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
}
