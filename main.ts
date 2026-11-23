// token-radar-01 entrypoint.
//
// Reads the sealed DefiLlama snapshot, scores every pre-token protocol with
// the comparables model in lib/model.ts, and lays out the submission in the
// output directory: board.json + data.js for the page, copies of dashboard/
// and screenshots/, and the dossier.json the judge actually reads.
//
// Run locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
// Inside the grading container --input defaults to /input/snapshot.json and
// the output directory defaults to /output.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// Directory this file lives in: dashboard/ and screenshots/ ship from here.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Caps the scorer enforces. Only the text budget shapes bytes; the rest refuse.
const DOSSIER_TEXT_BYTES = 65_536;
const SHOTS_MAX = 4;
const SHOTS_MAX_BYTES = 524_288;
const DASH_MAX_FILES = 400;
const DASH_MAX_BYTES = 4_194_304;
const FILE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

// Read a --flag value from argv, accepting both "--flag value" and "--flag=value".
function flagValue(name: string, fallback: string): string {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && ix + 1 < process.argv.length) return process.argv[ix + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

// Resolve the snapshot path: a file is used as-is, a directory gains snapshot.json.
const rawInput = flagValue('input', '/input');
const snapshotPath = rawInput.endsWith('.json') ? rawInput : join(rawInput, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  process.stderr.write(`token-radar: no snapshot found at ${snapshotPath} (pass --input <snapshot.json|dir> or mount the sealed /input)\n`);
  process.exit(2);
}

// Destination: explicit flag wins, then the local override, then the container path.
const destDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Score the snapshot; refuse to emit a board the gate would reject.
const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) {
  process.stderr.write(`token-radar: board rejected by the gate model: ${problem}\n`);
  process.exit(1);
}

// Copy every regular file of one directory into another, skipping dotfiles.
function copyDirFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const done: string[] = [];
  for (const entry of readdirSync(from)) {
    if (entry.startsWith('.')) continue;
    const src = join(from, entry);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, entry));
    done.push(entry);
  }
  return done;
}

mkdirSync(destDir, { recursive: true });
writeFileSync(join(destDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(destDir, 'data.js'), dataScript(radar));

copyDirFiles(join(repoRoot, 'dashboard'), join(destDir, 'dashboard'));
const shots = copyDirFiles(join(repoRoot, 'screenshots'), join(destDir, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token-radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}; the gate wants 3 (board, detail, filtered)\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!FILE_NAME.test(name)) {
    process.stderr.write(`token-radar: screenshots/${name}: names use letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// Dossier last: the scorer rebuilds it from this output and compares bytes.
writeFileSync(
  join(destDir, 'dossier.json'),
  buildDossier(destDir, {
    text_max_bytes: DOSSIER_TEXT_BYTES,
    screenshots: { max: SHOTS_MAX, max_bytes: SHOTS_MAX_BYTES },
    dashboard: { max_files: DASH_MAX_FILES, max_bytes: DASH_MAX_BYTES },
  }),
);

process.stdout.write(
  `token-radar: scored ${snapshot.protocols.length} protocols (${snapshot.watchlist.length} watchlisted) into ${board.length} rows ` +
    `(${radar.early_size} early finds, ${radar.live_size} live rows set aside)\n` +
    `token-radar: wrote board.json, data.js, dashboard/ and ${shots.length} screenshots plus dossier.json under ${destDir}\n`,
);

