// The token radar's comparables model: one snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) plus the early radar: pre-token protocols below the watchlist floor,
// the early rows the radar exists to find. A protocol is pre-token when its
// record carries no token (mcap_usd, gecko_id and symbol are all null); the
// snapshot's live-token protocols are kept apart in the Live view with the
// market's own capitalisation, never mixed into the ranked board.
//
// Implied value is a market-multiples estimate computed only from snapshot
// fields, in four bounded pieces:
//
//   multiple     = median(mcap_usd / tvl_usd) over tokened protocols in the
//                  same category (tvl_usd > 0, mcap_usd not null), when that
//                  category has MIN_PEERS (5) or more tokened peers; otherwise
//                  the global median over all tokened protocols. The used
//                  multiple is clamped to [MULT_MIN, MULT_MAX] ([0.02, 2.0]) so
//                  a thin category can never print an absurd value.
//   growthMult   = 1 + clamp(change_7d ?? 0, -40, +100) / 100 * 0.5
//                  (7-day TVL momentum, bounded to [0.80, 1.50])
//   maturityMult = 0.70 + min(age_days ?? 365, 1095) / 1095 * 0.45
//                  (days since listed_at: longer running with no token supports
//                  a fuller multiple; bounded to [0.70, 1.15])
//   breadthMult  = 1 + 0.05 * min(max(chains - 1, 0), 6)
//                  (chain breadth: deployed on more chains earns up to +30%,
//                  bounded to [1.00, 1.30])
//
//   implied = max(1, round(tvl_usd * multiple * growthMult * maturityMult
//                          * breadthMult))
//
// No protocol name is ever special-cased: the same function scores every row.
// Board membership is category-based, never name-based: centralized exchanges
// (CEX) and versioned pools ("Name V2") are left out everywhere, and the five
// wrapped/bridged/staked categories the house watchlist leaves out (Bridge,
// Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC) are left
// out above the watchlist floor, where each is a claim on an asset that
// already trades; below the floor they stay in as early finds.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  min_peers: number;
  mult_min: number;
  mult_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_steps: number;
}

export const MODEL: ModelConstants = {
  min_peers: 5,
  mult_min: 0.02,
  mult_max: 2.0,
  growth_weight: 0.5,
  growth_floor: -40,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.45,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_step: 0.05,
  breadth_max_steps: 6,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2-comps';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Categories left out of the board above the watchlist floor (the house
 *  watchlist leaves these out too: each is a wrapped, bridged or staked claim
 *  on an asset that already trades). Below the floor they stay in. */
export const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** One row of the category-multiples table the dashboard shows. */
export interface MultipleRow {
  category: string;
  peers: number;
  median: number;
  used: number;
  fallback: boolean;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlisted: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    multiple_used: number;
    multiple_source: string;
    peers: number;
    tvl_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlisted: boolean;
  implied_value_usd: number;
  multiple_used: number;
  multiple_source: string;
  peers: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_median: number;
  multiples: MultipleRow[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** mcap/TVL ratios of tokened protocols (mcap_usd not null, tvl_usd > 0), keyed by category. */
export function tokenMultiples(protocols: SnapshotProtocol[]): Map<string, number[]> {
  const byCat = new Map<string, number[]>();
  for (const p of protocols) {
    if (p.mcap_usd === null || !(p.tvl_usd > 0)) continue;
    const key = p.category ?? 'Uncategorized';
    const list = byCat.get(key) ?? [];
    list.push(p.mcap_usd / p.tvl_usd);
    byCat.set(key, list);
  }
  return byCat;
}

/** The median multiple per category plus the global fallback, clamped to [mult_min, mult_max]. */
export function buildMultiples(
  protocols: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { table: MultipleRow[]; globalMedian: number; lookup: Map<string, { used: number; source: string; peers: number }> } {
  const byCat = tokenMultiples(protocols);
  const all = [...byCat.values()].flat();
  const globalMedian = all.length > 0 ? medianOf(all) : 1;
  const clamp = (m: number): number => Math.min(model.mult_max, Math.max(model.mult_min, m));
  const table: MultipleRow[] = [];
  const lookup = new Map<string, { used: number; source: string; peers: number }>();
  for (const [category, ratios] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const med = medianOf(ratios);
    if (ratios.length >= model.min_peers) {
      table.push({ category, peers: ratios.length, median: round4(med), used: round4(clamp(med)), fallback: false });
      lookup.set(category, { used: clamp(med), source: `category median (n=${ratios.length})`, peers: ratios.length });
    } else {
      table.push({ category, peers: ratios.length, median: round4(med), used: round4(clamp(globalMedian)), fallback: true });
    }
  }
  return { table, globalMedian, lookup };
}

/** The multiple one category's pre-token protocols are scored with. */
export function multipleFor(
  category: string | null,
  lookup: Map<string, { used: number; source: string; peers: number }>,
  globalMedian: number,
  model: ModelConstants = MODEL,
): { used: number; source: string; peers: number } {
  const key = category ?? 'Uncategorized';
  const hit = lookup.get(key);
  if (hit !== undefined) return hit;
  const used = Math.min(model.mult_max, Math.max(model.mult_min, globalMedian));
  return { used, source: 'global median fallback', peers: 0 };
}

/** The four multipliers and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  lookup: Map<string, { used: number; source: string; peers: number }>,
  globalMedian: number,
  model: ModelConstants = MODEL,
): { implied: number; used: number; source: string; peers: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const { used, source, peers } = multipleFor(protocol.category, lookup, globalMedian, model);
  const rawGrowth = typeof protocol.change_7d === 'number' && Number.isFinite(protocol.change_7d) ? protocol.change_7d : 0;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const age = ageDays(asOf, protocol.listed_at);
  const ageEff = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageEff, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = 1 + model.breadth_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_steps);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * used * growthMult * maturityMult * breadthMult));
  return { implied, used, source, peers, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol below the watchlist floor may join the early radar. */
export function isEarlyCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category === 'CEX') return false;
  if (VERSIONED.test(p.name)) return false;
  return true;
}

/** Whether a protocol at or above the floor (outside the watchlist) may join the board. */
export function isAboveFloorCandidate(p: SnapshotProtocol, floorUsd: number): boolean {
  if (p.tvl_usd < floorUsd) return false;
  if (!isEarlyCandidate(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { lookup, globalMedian } = buildMultiples(snapshot.protocols, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the filters would leave
  // out (they currently leave none out, but coverage is never gambled).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the floor, except exchanges
  // and versioned pools. Never a replacement for a watchlist row.
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (p.tvl_usd >= snapshot.floor_usd) continue;
    if (!isEarlyCandidate(p)) continue;
    chosen.set(p.slug, p);
  }
  // Above the floor but off the watchlist: only protocols that could plausibly
  // launch a token (no exchanges, no versioned pools, no wrapped/bridged or
  // staked claims on assets that already trade).
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (!isAboveFloorCandidate(p, snapshot.floor_usd)) continue;
    chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => ({ p, s: impliedValue(p, snapshot.as_of, lookup, globalMedian, model) }));
  scored.sort((a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlisted: snapshot.watchlist.includes(s.p.slug),
    age_days: s.s.age,
    implied_value_usd: s.s.implied,
    model: {
      multiple_used: s.s.used,
      multiple_source: s.s.source,
      peers: s.s.peers,
      tvl_usd: s.p.tvl_usd,
      growth_pct: round4(s.s.growthPct),
      growth_multiplier: round4(s.s.growthMult),
      maturity_multiplier: round4(s.s.maturityMult),
      breadth_multiplier: round4(s.s.breadthMult),
      age_days: s.s.age,
    },
    farm_steps: farmSteps(s.p, s.s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A second chain for rotation steps, or null when the protocol names one. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The core on-chain action for the protocol's category, naming where it happens. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow'))
    return `Supply $${capital} of USDC to ${name}'s lending market on ${chain} through its app Supply tab, then borrow 10% of it and repay half to leave both legs on record.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('curation'))
    return `Deposit $${capital} of USDC into a ${name} curator vault on ${chain} through its app Vaults page and keep the vault shares in your wallet.`;
  if (c.includes('rwa') || c.includes('treasury') || c.includes('credit') || c.includes('prime'))
    return `Complete ${name}'s onboarding on ${chain}, mint $${capital} of its yield-bearing asset and hold it in the farming wallet.`;
  if (c.includes('dex') || c.includes('swap') || c.includes('amm') || c.includes('liquidity manager'))
    return `Provide $${capital} of two-sided liquidity to ${name}'s main pool on ${chain} through its app Pools page, keep the LP position in range for the full hold.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis') || c.includes('leveraged'))
    return `Deposit $${capital} of USDC as margin on ${name} on ${chain}, open one small long and one small short so both sides print volume, then close them the same week.`;
  if (c.includes('yield') || c.includes('farm') || c.includes('aggregator') || c.includes('vault'))
    return `Deposit $${capital} of USDC into ${name}'s flagship yield vault on ${chain} through its app Earn page and leave it compounding for the full hold.`;
  if (c.includes('bridge') || c.includes('canonical') || c.includes('gateway') || c.includes('cross chain'))
    return `Bridge $${capital} of USDC into ${chain} through ${name}'s own bridge interface, then supply the bridged funds once in the destination app so the receipt is used, not parked.`;
  if (c.includes('stak') || c.includes('restak') || c.includes('pool') || c.includes('validator'))
    return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} using its app Stake page and keep the liquid receipt token in your wallet.`;
  if (c.includes('prediction'))
    return `Fund ${name} on ${chain} with $${capital} and place one YES and one NO position in its most liquid market so both sides settle on record.`;
  if (c.includes('stable') || c.includes('wrapper') || c.includes('locker'))
    return `Mint $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet for the full hold.`;
  if (c.includes('payment') || c.includes('chain') || c.includes('network'))
    return `Bridge $${capital} of USDC to ${name}'s network on ${chain} and run two transactions a week in its flagship app (swap, transfer or quest) so the address is active.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} through its app Cover page and keep the policy for the full hold.`;
  if (c.includes('option') || c.includes('interest rate'))
    return `Deposit $${capital} of USDC into ${name}'s options or rate vault on ${chain} through its app and keep the position to expiry week.`;
  if (c.includes('index') || c.includes('basket') || c.includes('token set'))
    return `Mint $${capital} of ${name}'s index token on ${chain} through its app and hold it for the full hold.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} through its official app and keep the position open for the full hold.`;
}

/** The recurring weekly action for the protocol's category. */
function recurringAction(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow'))
    return `Each week, adjust the position once: top up $10 of supply, toggle part of the borrow, or claim and re-supply any rewards.`;
  if (c.includes('dex') || c.includes('swap') || c.includes('amm'))
    return `Each week, collect and re-add $5 of fees to the pool position, and run one $10 swap through the same pool.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis'))
    return `Each week, open and close one small hedged trade pair so weekly volume prints without directional risk.`;
  if (c.includes('bridge') || c.includes('canonical') || c.includes('gateway') || c.includes('cross chain'))
    return `Each week, bridge $10 back or forth through the protocol so more than one week shows bridge volume.`;
  if (c.includes('stak') || c.includes('restak') || c.includes('pool'))
    return `Each week, restake $5 of staking rewards through the same receipt so compounding events accumulate on record.`;
  if (c.includes('prediction'))
    return `Each week, settle or roll one market position and open the next week's position in the most liquid market.`;
  return `Each week, perform one qualifying action in the app: a $10 deposit, a swap, a vote, or a rewards claim.`;
}

/**
 * A protocol's farm plan: six steps derived from its own record (category,
 * chains, TVL, age) — the action names where it happens, and every step
 * carries what it costs and how long it takes. No name is special-cased.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Create a fresh wallet that holds only farm funds, fund it with $${capital} plus about $15 of the ${chain} gas token, and store the seed phrase offline.`,
      cost: 'about $3 of gas for funding',
      time: '10 minutes to set up',
    },
    {
      text: coreAction(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: recurringAction(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: second !== null
        ? `Repeat the core position once on ${second} so the same wallet shows activity on two of the protocol's chains, then hold every position for at least ${hold} days to span more than one snapshot.`
        : `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and never fully withdraw between weekly actions.`,
      cost: second !== null ? `an extra $25 of capital and about $3 of gas on ${second}` : `the $${capital} stays in the position`,
      time: `${hold} days across snapshots`,
    },
    {
      text: `Before you unwind, open the protocol's own points or rewards page from its official site, confirm your wallet's score, and claim only through the link it publishes.`,
      cost: 'no fee to check, never pay to claim',
      time: '10 minutes to verify',
    },
    {
      text: `Log the wallet address, each transaction hash and the dates in a farm journal so you can repeat the position or unwind it after any token event.`,
      cost: 'nothing but the log',
      time: '5 minutes per entry',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlisted: row.watchlisted,
    implied_value_usd: row.implied_value_usd,
    multiple_used: row.model.multiple_used,
    multiple_source: row.model.multiple_source,
    peers: row.model.peers,
    growth_pct: row.model.growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const { table, globalMedian } = buildMultiples(snapshot.protocols, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_median: round4(globalMedian),
    multiples: table,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
