# Performance and accessibility evidence

## Reproducible production checks

Run `npm run test:e2e` using the production preview, not the Vite development server. Browser tests are serial to reduce contention. `test-results` retains benchmark JSON and axe reports; failures retain screenshots and traces.

The plan's provisional target is **no application analysis task blocking the main thread for more than 100 ms**. Performance tests assert the exact main-thread long-task duration, not total file size or a successful render as a proxy. They also bound SVG nodes, predictor groups, and editor fields.

The browser Long Tasks API records tasks of at least 50 ms. An empty recorded list means no task reached that reporting threshold during the measured interval; it does not mean processing took zero time. Worker processing can take longer while the main thread remains available and import remains cancelable. End-to-end durations include browser automation overhead.

## Local evidence, 2026-10-06 to 2026-10-07

Hardware: Windows, Intel Core Ultra 7 165U; browser: headless Chrome 154.0.8037.58; 14 logical threads reported. This is a shared local host, not dedicated benchmark hardware.

| Workload | Before hardening | Hardened evidence |
|---|---|---|
| Synthetic 6,523,516-byte, 130-tree, 132,990-node model | About 13.4 s import-to-render; main tasks 185 / 4561 / 85 / 5750 ms | Final acceptance full-suite run: 2091 ms import-to-render; no >=50 ms import task recorded; worker read/parse/validate 160.4 ms and indexing 112.5 ms |
| Actual changed edit on that model | About 1096 ms to two frames; 1020 ms blocking task | Final acceptance run: 210 ms end-to-end and no >=50 ms edit task; route changed, not a no-op |
| 8,191 nodes / 4,095 distinct predictors | Independent judge reproduced 148 / 649 ms blocking from unbounded groups/fields | Final acceptance run: no >=50 ms task recorded; earlier full run recorded 70 ms; both exact <=100 ms gates passed with groups bounded to 20 and fields to 25 |
| Tree drawing | One 1023-node diagram measured 190,232 CSS px wide | Initial depth collapse, subtree navigation and hard 127-visible-node budget; synchronized bounded textual outline |

These are **synthetic regression measurements**, not guarantees for every admitted export/device. Subsequently supplied production exports are measured separately below; their private local evidence is not approval to redistribute a reference corpus.

The pre-corpus acceptance commands passed 77 unit/component tests and 13 production browser tests. After production tag adaptation and private corpus coverage, the full commands `npm test`, `npm run typecheck`, `npm run build` and `npm run test:e2e` passed **90 unit/component and 15 browser tests**, with both private inputs enabled. Ordinary CI skips the two private tests when no approved input paths are configured. TypeScript checks include browser tests/configuration.

## Owner-supplied production corpus, 2026-10-07

Both original files were tested unmodified, locally, without placing them in the checkout or sending their contents to external services. Their UUID-v4 export tags differ from the bundled sample's `"2"`; the adapter preserves those tags, validates the complete observed shape and keeps all scoring unverified.

| Workload | Bytes / trees / nodes / predictors | Import to interactive | Actual changed-route edit | Worker parse/validate / index |
|---|---|---|---|---|
| RBO | 12,504,681 / 110 / 17,748 / 234 | 1005 ms | 71 ms | 252.3 / 65.4 ms |
| Web | 5,428,277 / 130 / 16,206 / 196 | 469 ms | 72 ms | 77.9 / 46.0 ms |

Both have maximum depth seven edges. In the final full-suite run, no main-thread task reached the Long Tasks API's 50 ms reporting threshold during measured import, editor opening or edit intervals; the exact <=100 ms gates passed. An earlier private Web import recorded 53 ms, also within the gate. End-to-end timings vary with host/browser/automation overhead and are not worker execution times.

The private journeys also checked matching canonical/UI node and tree counts, real root-branch changes, the second occurrence page, exact repeated selected-node focus, bounded SVG rendering, 390 px reflow, worker termination on **Open another**, and no local/session storage after reload.

### Memory observations, not a secure-erasure guarantee

Chrome CDP V8 used-heap snapshots recorded approximately:

| Corpus | Main heap after import | Worker heap after import | Main heap after edit | Main heap after close + forced GC | Main heap after reload + forced GC |
|---|---|---|---|---|---|
| RBO | 36.5 MiB | 26.5 MiB | 45.1 MiB | 35.0 MiB | 2.1 MiB |
| Web | 16.4 MiB | 7.1 MiB | 25.9 MiB | 13.4 MiB | 2.1 MiB |

Baseline main used heap was about 2.7 MiB. Closing removed the workspace and terminated its worker, but did **not** immediately return renderer heap to baseline, even after GC. This does not prove secure memory erasure or a leak; repeat-cycle/peak/process-RSS testing and an agreed memory budget remain open. Reload returned these measured renderer heaps near baseline. Worker snapshots and main snapshots are distinct; these figures are not total browser/OS memory.

The missing-corpus blocker is now narrowed: **local compatibility and responsiveness evidence exists for these two actual exports**. Authorized anonymization/retention/redistribution, a broader agreed device/corpus matrix and score-oracle verification remain separate gates.

## Why the architecture changed

Measured parse/index and large DOM work blocked the original UI. Canonical conditions are parsed once per unique condition, predictor sorting reuses a collator, metrics/indexing run in the local worker, tree data arrives in 512-node chunks rather than one huge clone, and UI collections are bounded/paginated. No synchronous worker-failure fallback exists. Progress, cancel, explicit failure and retry are covered.

The worker owns full predictor occurrence indexing and pages exact occurrences to the UI. It does not send data to another host or change score authority.

## Accessibility evidence and remaining gates

- Automated axe WCAG A/AA scans cover start, exploration, and open profile editor in a real production browser.
- Trace labels previously measured 3.56:1 at 9 px; contrast and type sizes were corrected and real-browser scans cover them.
- Keyboard activation, initial workspace-title focus, repeated occurrence selection, blocked-feature edit focus, exact selected-node reveal, and a synchronized textual outline are regression-tested.
- Browser journeys cover 320, 390, 768 and 1440 CSS px, page reflow and reduced-motion preference. These are emulated viewports, not physical device certifications.
- Branch meaning is textual (True / Left, False / Right), not color alone. Inputs expose invalid states/descriptions; global blockers link to the stage and field.

Automated scans do not establish complete WCAG conformance. Manual screen-reader review, zoom/reflow on assistive technology, physical device/browser coverage, and practitioner/non-expert usability review remain external release checks.
