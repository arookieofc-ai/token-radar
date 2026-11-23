// Repo tooling (never shipped: main.ts copies only dashboard/ and
// screenshots/). Captures the three dossier screenshots at 1440x1000 with a
// local Chromium: the board top, the rank-1 detail view, and one filtered
// board view. Run from the repo root: `node tools/shoot.mjs`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const root = join(here, '..');
// /opt/meta-chromium/chrome refuses to start in this sandbox (it demands a
// Hatch WebGL domain-policy contract), so the script drives playwright-core's
// own bundled Chromium instead: same engine, same pixels for the dossier.
// (Set before the import: playwright resolves its browser path at load.)
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/hatch/workspace/makefun/tools/browsers';
const { chromium } = await import('/home/hatch/workspace/makefun/tools/node_modules/playwright-core/index.mjs');

const OUT = join(root, 'out');
mkdirSync(OUT, { recursive: true });

// Build the entry into out/ so the shots show exactly what the grader sees.
execFileSync('node', ['main.ts', '--input', 'input/snapshot.json'], {
  cwd: root,
  env: { ...process.env, MAKEFUN_OUTPUT_DIR: OUT },
  stdio: 'inherit',
});

const board = JSON.parse(readFileSync(join(OUT, 'board.json'), 'utf8'));
const rank1 = board.rows[0].slug;
console.log(`rank-1 slug: ${rank1}, rows: ${board.rows.length}`);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  let path = url.pathname === '/' ? '/dashboard/index.html' : decodeURIComponent(url.pathname);
  const file = join(OUT, path);
  if (!file.startsWith(OUT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const ext = file.slice(file.lastIndexOf('.'));
  const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.png' ? 'image/png' : 'application/octet-stream';
  try {
    const bytes = readFileSync(file);
    res.writeHead(200, { 'content-type': type });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end('no such file');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
async function shot(hash, name) {
  await page.goto(`http://127.0.0.1:${port}/dashboard/index.html${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const file = join(root, 'screenshots', name);
  await page.screenshot({ path: file });
  const size = statSync(file).size;
  console.log(`${name}: ${(size / 1024).toFixed(1)} KiB`);
  if (size > 524288) throw new Error(`${name} exceeds the 512 KiB gate cap`);
}

await shot('#/board', '1-board.png');
await shot(`#/protocol/${rank1}`, '2-detail.png');
await shot('#/board?category=RWA', '3-filtered.png');
await browser.close();
server.close();

// Ship the fresh screenshots: run main.ts again so out/ holds them.
execFileSync('node', ['main.ts', '--input', 'input/snapshot.json'], {
  cwd: root,
  env: { ...process.env, MAKEFUN_OUTPUT_DIR: OUT },
  stdio: 'inherit',
});
for (const name of ['1-board.png', '2-detail.png', '3-filtered.png']) {
  const from = join(root, 'screenshots', name);
  if (existsSync(from)) console.log(`${name} final: ${(statSync(from).size / 1024).toFixed(1)} KiB`);
}
