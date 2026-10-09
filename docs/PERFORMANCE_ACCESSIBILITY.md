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

## Repeated lifecycle regression and transfer profiling, 2026-10-09

Production Chrome on the same shared Intel Core Ultra 7 165U host reproduced the
previous synthetic regression: both large-import baseline repetitions exhausted
the unchanged **5,000 ms workspace-readiness assertion**. The high-cardinality
baseline also recorded a **126 ms** task, exceeding the unchanged **100 ms** gate.
A separate CDP diagnostic run with the old transfer scheduling reproduced a
**112 ms** synthetic renderer task; the previously reported 156 ms duration is
not claimed as an exact reproduction on this run.

The old worker posted 512-node chunks followed by nested `setTimeout(0)` calls.
Diagnostic worker-message timestamps showed 260 chunks spanning **2,172.6 ms**,
median inter-chunk gap **6.3 ms**, maximum **157.4 ms**. This added timer-clamping/
scheduling latency after parsing and indexing. CPU/timeline profiling also
identified a **112.1 ms renderer FunctionCall** and a **99.0 ms workspace Layout**
with **1,746 layout objects**, rather than a large synchronous main-thread parse.
Renderer CPU samples also included substantial browser-automation `visitNode`
traversal; the exact browser gate honestly includes that measurement overhead.
CDP profiling itself adds overhead; these diagnostic traces explain work, not
acceptance timings, and browser layout/host contention can still affect the gate.

The worker now uses receiver acknowledgements with a **four-chunk credit
window**. Each message remains limited to 512 nodes; at most **2,048 sent nodes**
are awaiting acknowledgement. This bounds queued transfers without nested
timers or a serialized round trip per chunk, does not synchronously fall back,
and still allows worker termination while transferring. The client clears its flat
reconstruction array and workspace reference and replaces the import handler on
completion; invalid imports now terminate their idle worker. Lifecycle tests
cover timer cleanup, repeated disposal, cancellation and fresh retries.
Coordinated UI hardening limits ensemble navigation to **25 rows per page** and
mounts predictor occurrence buttons only when their group is open, reducing
render/layout and locator traversal work rather than excluding it from timing.

The first two non-profiled production acceptance imports completed in **2,027 /
4,155 ms**, with maximum import tasks **78 / 81 ms**. Actual changed-route edits
completed in **400 / 766 ms**, with no >=50 ms edit task. High-cardinality maximum
tasks were **68 / 62 ms**. The test also checks the **entire import/editor/edit
interval**; opening an editor is not excluded between separately reported phases.
Observers retain all entries, include tasks overlapping interval boundaries,
flush pending records after two frames and a task turn, and record worker
message timestamps. No readiness timeout or blocking threshold was raised.

After coordinated DOM reduction, **three complete non-profiled repetitions**
passed all **15 performance/lifecycle browser tests**:

| Repetition | Synthetic import / changed edit | Maximum import task | Maximum high-cardinality task |
|---|---|---|---|
| 1 | 1,641 / 221 ms | 77 ms | 61 ms |
| 2 | 1,134 / 180 ms | No >=50 ms task | No >=50 ms task |
| 3 | 1,545 / 205 ms | No >=50 ms task | 53 ms |

Every actual edit changed a supplied value and exposed `Inspect changed Tree 1`;
no >=50 ms task occurred in the edit intervals. All **132,990 nodes** were
transferred in chunks of at most 512. Transfer spans were **659.2 / 529.0 /
547.7 ms**, versus the profiled timer baseline's 2,172.6 ms (not a controlled
CPU-overhead comparison). The complete measured import/editor/edit interval
also remained <=100 ms.

An additional integrated-checkout refresh challenged the initial
**one-chunk stop-and-wait** implementation: **14/15 tests passed**, but one
five-cycle journey hit the unchanged 5,000 ms readiness assertion on its fourth
import. Its three completed cycles still closed with zero workers and bounded
heap; this failed run is retained, not discarded as acceptance. Successful
earlier repetitions alone did not establish reliable readiness under shared-host
load. The four-chunk window was then reproduced red in a worker test (expected
four initial messages, received one), and made green without enlarging messages,
raising timeouts or relaxing the 100 ms gate. The test proves no fifth message
is sent until an acknowledgement, exact ordered reconstruction of 4,103 nodes,
and continued paged occurrence requests. Lifecycle interval evidence is now
also retained on failure.

**Prior load-sensitive refresh: not fully green.** The subsequent four-chunk refresh
passed **13/15 tests**. All three standalone synthetic/high-cardinality
performance pairs passed: imports **2,706 / 1,142 / 2,248 ms**, changed edits
**554 / 257 / 315 ms**, maximum import tasks **98 / 53 / 72 ms** and
high-cardinality maxima **71 / 64 / 60 ms**. However, two five-cycle journeys
still exhausted the unchanged 5,000 ms workspace assertion on a later import.
Their retained full-interval diagnostic includes a **102 ms** task in the first
journey; it must not be treated as a passing 100 ms gate just because readiness
failed first. All nine completed cycles closed with zero workers and bounded
heap. The third journey completed all five cycles, with maximum task **64 ms**,
warm heap growth **0.272 MiB** and reload heap **2.24 MiB**.

The bounded-window protocol and client lifecycle tests passed **9/9**;
TypeScript and the production build passed. Four-chunk pipelining removes a
serialized round trip and preserves explicit queue bounds, but **does not yet
establish reliable readiness or the exact task gate on this shared host**.
Evidence remains in `remaining-performance\handoff-repeated` and
`remaining-performance\pipelined-acceptance`; earlier green runs are historical,
not a substitute for these later failures. No timeout was raised, task threshold
lowered, timing interval hidden, or external process terminated to manufacture
acceptance. Independent performance review and integrated-corpus acceptance are
still required before marking this gate complete.

### Fresh post-judge local acceptance

After the independent judge's filtered-list pagination finding was reproduced
and fixed, the stable integrated checkout passed **18/18 production browser
tests across three repetitions**. This includes the filtered predictor-selection
journey with both matching and excluding tree filters, all performance tests,
and the five-cycle/invalid/cancel lifecycle tests. The existing 5,000 ms workspace
assertion and exact 100 ms task gate were unchanged.

| Repetition | Synthetic import / changed edit | Maximum synthetic task | Maximum high-cardinality task | Maximum five-cycle task |
|---|---|---|---|---|
| 1 | 1,161 / 255 ms | 52 ms | 59 ms | 60 ms |
| 2 | 1,113 / 282 ms | 55 ms | 61 ms | 63 ms |
| 3 | 1,092 / 214 ms | No >=50 ms task | 61 ms | No >=50 ms task |

No >=50 ms edit task was recorded. Transfer spans were **343.4 / 345.2 /
241.4 ms**. All **15 large lifecycle imports** completed (range **1,077–1,923 ms**)
and all 15 closes left zero workers. Sampled live renderer heap maxima were
**25.43 / 23.71 / 22.60 MiB**; post-close growth after warm-up was **0.231 /
0.276 / 0.231 MiB**. Closed heaps ended **11.99–12.04 MiB**, baseline **2.03 MiB**,
and reload **2.19–2.24 MiB**, within every explicit budget.

Latest evidence is in `remaining-performance\post-judge-repeated`. The 5180
preview port was checked to have **no listener** after completion. An earlier
reported handoff briefly left a preview listening; it exited naturally before
this run, and no process was killed or unverified existing server reused.

This fresh **local acceptance is green**, but it does not invalidate the
preserved earlier loaded-host failures or prove that filtered-pagination repair
caused the timing improvement. Broader-device/load reliability, integrated
authentic-corpus acceptance, peak/process RSS and product-approved memory budgets
remain separate gates.

### Provisional local retention budgets

`e2e/lifecycle.spec.ts` repeats the **6,523,516-byte / 130-tree / 132,990-node
synthetic** import, genuine changed-route edit, and close five times in the same
renderer without reloading between cycles. It asserts:

- Exactly one analysis worker while open, zero after every close/rejected export.
- Sampled live main V8 used heap <= **64 MiB**.
- Forced-GC post-close heap <= baseline + **24 MiB**.
- Post-close growth after two warm-up cycles <= **4 MiB**.
- Reloaded forced-GC heap <= baseline + **8 MiB**.
- The unchanged **100 ms** task gate across the entire five-cycle interval,
  including imports, editor opening, edits and closes.

These are explicit **local synthetic regression budgets**, not an approved
all-device/product memory budget. They bound residuals and repeated growth rather
than claiming immediate erasure: a closed React renderer can retain the previous
workspace until subsequent rendering/collection. The first five-cycle run
sampled **17.1–27.4 MiB** live main heap; forced-GC closed heap was
**11.45 / 11.82 / 11.92 / 12.01 / 12.10 MiB**, baseline **2.03 MiB**, reload
**2.24 MiB**. Every worker terminated. Closed growth from cycle two to five was
about **0.28 MiB**; maximum measured task was **88 ms**.

The final tighter-budget acceptance repeated the five-cycle journey **three
times (15 large imports/edits/closes)**. Imports ranged **954–1,588 ms**; sampled
live heap maxima were **21.42 / 21.45 / 21.80 MiB**. Each closed-heap sequence
started around **11.39 MiB** and ended **11.99–12.00 MiB**; growth after warm-up
was **0.232 / 0.227 / 0.226 MiB**, reload **2.19 MiB**, baseline **2.03 MiB**.
All 15 closes left zero workers. Maximum lifecycle task was **56 ms** in the
first repetition; the other two recorded no >=50 ms tasks. Invalid/retry and
deliberately held-import/cancel/retry journeys also passed in each repetition.
The deterministic cancellation fixture holds the first request before worker
processing; it is not evidence of cancellation at every possible parser point.

Sampling at import/edit/close is **not a peak measurement**. V8 main used heap
excludes worker heap, native allocations, GPU buffers and browser/OS process RSS;
forced GC alters collection behavior. Zero live worker targets demonstrates
termination, not reclaimed process pages or secure erasure. Repeated authentic
corpus/worker-heap/process-RSS measurements, an agreed device matrix and approved
retention budgets remain release gates.

Run the production performance/lifecycle tests with the installed Chrome channel:
`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- performance.spec.ts lifecycle.spec.ts --repeat-each=3`
(set environment variables using your shell's syntax). Set `E2E_OUTPUT_DIR` to an
approved external artifact directory for private runs. Optional
`AGB_PROFILE_TIMELINE=1` emits `diagnostic-timeline.json`; do not use a profiled
run as acceptance evidence. Synthetic timing/heap and failed-interval evidence
is written alongside browser artifacts; private export contents are not required.

Earlier validation on the combined checkout passed **125 unit/component tests** with
`npm test -- --maxWorkers=1`, TypeScript and production build. A default
multi-fork unit run exhausted startup responsiveness on this shared host; running
serially resolved those infrastructure timeouts without raising them. Artifacts
for this stage remain in the approved external `remaining-performance` directory,
not a redistributed authentic corpus or a dedicated-hardware certification.

## Accessibility evidence and remaining gates

### Integrated acceptance, 2026-10-09

The final serial integrated run passed **128 unit/component tests**, TypeScript,
production build and **2 reference-host boundary tests**. Production Chrome passed
**27/27 browser tests**, including both original private exports, each repeated for
five import/real-edit/close cycles in the same renderer. Edge passed **20/20 UX,
privacy and accessibility tests** and the separate hardened `/ExperienceAGB/`
sample/worker/home smoke; the default build was restored afterward. Chrome and
Edge are both Chromium engines, not independent-engine certification.

| Final Chrome workload | Import / actual changed edit | Main-thread long tasks |
|---|---|---|
| 132,990-node synthetic | 1,032 / 153 ms | No >=50 ms task over the measured import/editor/edit interval |
| 4,095-predictor synthetic | Bounded 25 tree rows, 20 predictor groups and 25 editor fields | Maximum 55 ms |
| Five same-renderer large synthetic cycles | Imports 1,047-1,118 ms | No >=50 ms task across the full measured lifecycle interval |
| RBO: five same-renderer authentic cycles | Imports 989-1,122 ms; edits 83-136 ms | Maximum 61 ms; no >=50 ms task in cycles 2-5 |
| Web: five same-renderer authentic cycles | Imports 488-972 ms; edits 66-131 ms | Maximum 51 ms; no >=50 ms task in cycles 2-5 |

The exact **100 ms** gate and **5-second** workspace readiness assertions remain
unchanged. The final synthetic lifecycle sampled at most **22.36 MiB** live main
heap, **0.227 MiB** closed growth after warm-up and zero workers after all five
closes. Authentic provisional budgets were declared before the run: sampled live
main heap <=128 MiB, closed heap <=baseline+64 MiB, growth after two warm-up cycles
<=4 MiB. RBO sampled at most **41.88 MiB**, warm closed growth **0.137 MiB**;
Web sampled at most **20.41 MiB**, growth **0.134 MiB**. All ten authentic closes
terminated their worker. Closed heaps remained about **35.5 / 13.7 MiB**, not
baseline; reload returned both near **2.14 MiB**. This is bounded sampled retention,
not peak/RSS, repeated worker-heap, secure-erasure or universal-budget proof.

Final axe scans independently check start, exploration, open trace editor and
expanded local AI context preview. Four scans in one test previously exceeded
the 60-second test budget on the shared host; separate surface cases now pass
without raising that budget. A delayed route-continuation cancellation fixture
raced request disposal; it now deterministically holds sample fetch until its
actual AbortSignal fires, alongside the separate real-worker cancellation case.
Transient port-5180 ownership/startup races caused infrastructure failures;
the final full run used the validated explicit `E2E_PORT=5280`, with strict port
ownership and no server reuse. Earlier failures remain retained in external
evidence, not erased or relabeled as passes.

Actual Tab/Enter, repeated selected-node focus, 320/390/768/1440 px journeys,
reduced motion and half-width/high-DPI reflow passed in both installed browsers.
That last emulation is **not actual browser zoom**. Firefox/WebKit restoration
failed due download timeouts, so those engines, physical devices and assistive
technology remain manual/external gates. AI is local scaffolding only: the retired
provider is hard-blocked and no live inference request was made.

- Automated axe WCAG A/AA scans cover start, exploration, and open profile editor in a real production browser.
- Trace labels previously measured 3.56:1 at 9 px; contrast and type sizes were corrected and real-browser scans cover them.
- Keyboard activation, initial workspace-title focus, repeated occurrence selection, blocked-feature edit focus, exact selected-node reveal, and a synchronized textual outline are regression-tested.
- Browser journeys cover 320, 390, 768 and 1440 CSS px, page reflow and reduced-motion preference. These are emulated viewports, not physical device certifications.
- Branch meaning is textual (True / Left, False / Right), not color alone. Inputs expose invalid states/descriptions; global blockers link to the stage and field.

Automated scans do not establish complete WCAG conformance. Manual screen-reader review, zoom/reflow on assistive technology, physical device/browser coverage, and practitioner/non-expert usability review remain external release checks.
