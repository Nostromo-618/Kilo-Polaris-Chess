# uncapped-aurora-match-mode — tasks & running log

## 1. Engine

- [x] 1.1 `AI.findBestMove` accepts `uncapped` (level-6 features, no depth cap, timeout-bound); levels 1-6 unchanged
- [x] 1.2 Uncapped max-depth ceiling (`UNCAPPED_MAX_DEPTH = 56`); killer table resized 64 -> 128 slots (indexing was already bounds-guarded)

## 2. Plumbing & UI

- [x] 2.1 `engineAdapter.js` Aurora path + `ai.worker.js` forward `uncapped`
- [x] 2.2 Storage key `kpc-match-aurora-uncapped` + getter/setter
- [x] 2.3 `useGameStore` per-engine uncapped side config; `MatchSettings.vue` Aurora toggle; `MatchInfoModal.vue` copy

## 3. Harness

- [x] 3.1 `control-equal-time.mjs --aurora-uncapped` (default off; distinct results label `control-both-uncapped-*`)
- [x] 3.2 `vs-tomitank.mjs --aurora-uncapped` (opt-in, symmetric)

## 4. Tests & gates

- [x] 4.1 `AI.spec.js`: uncapped exceeds depth 22 with budget (KPvK probe: capped 22 @0.6s, uncapped 28 @2.5s in Node), deterministic, respects timeout
- [x] 4.2 Store test: `getMatchSideConfig` uncapped mapping per engine (e2e `engine-match.spec.js`)
- [x] 4.3 Gates: `test:quick` 954/954, `test:baseline` 3/3, perft OK, `openspec validate` strict valid

## 5. Measurement & release

- [ ] 5.1 Uncapped-vs-uncapped control run recorded (score + 95% CI) — RUNNING
- [x] 5.2 `package.json` -> 3.4.0; `js/data/changelogData.js` v3.4.0 entry (v3.3.0 `latest: false`)
- [ ] 5.3 Archive change after merge (left for the user)
