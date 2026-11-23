# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/arookieofc-ai/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/arookieofc-ai/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A pre-token launch radar over 758 DefiLlama protocols: each protocol with no recorded token is priced by an implied value from a comparables model (its TVL times the median market-cap-to-TVL multiple of already-tokened peers in its category, adjusted for 7-day momentum, time running tokenless and chain breadth), then served in a static dashboard with a sortable board, per-protocol detail views, filters and a concrete costed farm plan for every ranked row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9dq35t8z&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
