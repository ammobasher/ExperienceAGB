# Performance and accessibility evidence

## Reproducible production checks

Run `npm run test:e2e` using the production preview, not the Vite development server. Browser tests are serial to reduce contention. `test-results` retains benchmark JSON and axe reports; failures retain screenshots and traces.

The plan's provisional target is **no application analysis task blocking the main thread for more than 100 ms**. Performance tests assert the exact main-thread long-task duration, not total file size or a successful render as a proxy. They verify complete selected-tree node/leaf/link counts, while keeping ensemble/predictor navigation and editor fields paginated.

The browser Long Tasks API records tasks of at least 50 ms. An empty recorded list means no task reached that reporting threshold during the measured interval; it does not mean processing took zero time. Worker processing can take longer while the main thread remains available and import remains cancelable. End-to-end durations include browser automation overhead.

## Optional propensity-mapping acceptance, 2026-10-15

The optional local companion panel was checked against synthetic mappings, not
a native Pega Classifier export or platform oracle. Its explicit-domain/method
contract, exact file binding, boundary selection, unavailable states and
confirmation lifecycle have unit/component coverage. Desktop and mobile
production journeys cover actual template downloads, keyboard confirmation,
profile changes, incomplete routes, out-of-range scores, mismatched imports,
view preservation, clearing/reload, axe A/AA, page reflow and absence of
browser storage or unapproved writes. Both screenshots were inspected.

| Fresh check | Result |
|---|---|
| `npm run typecheck` and root `npm run build` | Passed |
| `npm test -- --pool=threads --maxWorkers=2 --reporter=dot` | 260 passed across 31 files |
| `npm run test:server` | 47 passed, mocked providers |
| Complete production Chrome run, `E2E_PORT=5194` | 45 passed; two unconfigured private-corpus cases skipped |
| Subpath production hosting smoke | One passed; root assets subsequently restored |

The 1,000-interval companion (76,902 bytes) mounted only 20 exact table rows,
revealed the matched page and preserved the unchanged 100 ms gate across file
read, parsing, confirmation, chart rendering and paging. No task reached the
50 ms Long Tasks API threshold. In the same final complete run, the
132,990-node forest imported/drew in 2,329 ms and edited in 154 ms, with no
reported long task; high-cardinality exploration/editor peaked at 75 ms and
insights/audit export at 79 ms. Five lifecycle cycles had no reported long task,
a maximum sampled live renderer heap of 25,596,348 bytes and zero remaining
workers after every close.

The first complete run recorded a 161 ms task during the large-tree import
interval in the existing insights/audit benchmark: 44 passed, one failed and
two skipped. The isolated recheck peaked at 87 ms; the subsequent complete run
passed at 79 ms without application changes or relaxed limits. The initial
failure remains in external evidence; its cause was not established, and later
passes are not a universal shared-host performance guarantee.

Logs, performance JSON, screenshots and axe evidence remain outside the
checkout. Scoped 5182/5194 verification hosts stopped; the existing configured
5183 host was preserved and verified serving the new root assets. No native
Pega mapping, live inference, private corpus, physical device, independent
browser engine or manual screen-reader acceptance is claimed. See
[the companion contract](PROPENSITY_MAPPING.md) for the required source evidence
and platform-parity limitations.

## Visual readability acceptance, 2026-10-15

The published v6.4 baseline is `476bbef`; its hosted CI passed. A subsequent
local visual refinement was reviewed using the bundled sample and generated
snapshots, not private exports or live inference. The light theme now has
descriptive, color-accented mode cards, a selected-task guide, readable metric
cards and body copy, plain-language score explanations and a labeled diagram
legend. Colors distinguish tasks/node types, not quality or causal influence.
Long decimal displays are shortened and shares are percentages; original
numbers remain in native disclosures, exact tables and unchanged audit exports.
The diagram-label regression cases cover predictor names containing `in`/`is`.

Fresh commands and results:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test -- --pool=threads --maxWorkers=2 --reporter=dot` | 216 tests passed across 29 files |
| `npm run test:server` | 47 passed, mocked providers |
| `npx playwright test --reporter=line` with Chrome and `E2E_PORT=5194` | 42 passed; two unconfigured private-corpus cases skipped |
| `npx playwright test --config=e2e\hosting.config.ts --reporter=line` | One subpath smoke passed |
| Final `npm run build` | Passed; root assets restored |

The two new production visual journeys inspect start/explore/trace/overview/
predictors/history/evolution at 1440 × 1000 and 390 × 844, record screenshots
and axe WCAG A/AA findings, assert no page-level horizontal overflow, verify
the four-/two-column mode layout, activate exact-number disclosures with
Enter, check percentages and confirm zero non-GET requests/page errors. Existing
320/390/768/1440 keyboard journeys, fullscreen, response/privacy/error paths and
unchanged performance/lifecycle gates also passed. Desktop/mobile screenshots
were inspected; the synchronized text outline was additionally scrolled into
view and checked in the live browser canvas.

| Workload in the complete run | Observation |
|---|---|
| 132,990-node forest, complete selected tree and actual edit | Import/drawing 3,613 ms; edit 172 ms; no task reached the 50 ms Long Tasks API reporting threshold |
| 8,191-node tree / 4,095 predictors with editor | No task reached 50 ms |
| Same node/predictor counts with insights, tables and worker JSON audit | Maximum observed main-thread task 72 ms |
| Five large import/edit/close cycles | Maximum task 63 ms; maximum sampled live renderer heap 24,251,024 bytes; warmed closed growth 425,552 bytes; zero remaining workers after every close |

No 100 ms limit, readiness assertion, heap budget, required node/link count or
test deadline was relaxed. Earlier targeted attempts found invalid Testing
Library role-query options, an intentionally rewritten copy assertion and
jsdom's absent native Enter-to-toggle behavior for details. Query/copy assertions
were corrected; unit coverage uses native click, while production browser
coverage verifies Enter. Both targeted browser journeys and the subsequent
complete run passed. The first screenshots also exposed a legacy flex rule
overriding the intended mode-card grid; a scoped selector and computed-layout
assertion now protect the responsive grid.

Evidence and logs are in the session artifacts outside the checkout. Scoped
5182/5194 helpers stopped; the user's existing credential-configured 5183 host
was preserved and serves the new root build. These checks do not establish
physical-device, cross-browser or manual screen-reader acceptance, successful
live-provider inference, independent Pega parity or full v6.4 certification.

## v6.4 local analytics acceptance, 2026-10-15

The final complete production Chrome run passed **40 checks**, with the two
unconfigured private-corpus cases skipped. The six added audit journeys cover
desktop/mobile charts and exact tables, keyboard links into the complete tree,
axe A/AA, one bottom AI panel, no unapproved writes, actual worker source/category
hashes, sensitive-download approval, script-free offline HTML with no HTTP(S)
requests, snapshot gain/threshold/category comparisons and duplicate-key errors.
Desktop/mobile predictor and history screenshots were inspected. SVG charts
retain readable dimensions in keyboard-focusable horizontal scroll regions;
the page itself does not overflow at 390 px.

All final measurements below came from the same complete run, using generated
models, production assets and installed Chrome on the shared Windows host:

| Workload | Final observation |
|---|---|
| 132,990-node forest, complete selected tree, editor and actual changed-route edit | Import/drawing 1,928 ms; edit 152 ms; no task reached the Long Tasks API's 50 ms reporting threshold across the interval |
| 8,191-node tree / 4,095 predictors, complete drawing and profile editor | Maximum observed task 53 ms |
| Same node/predictor counts, insights, predictor/context tables and worker JSON audit preparation | Maximum observed task 78 ms; complete diagram retained, tables rendered 20 rows each, actual export reply observed |
| Five large import/edit/close cycles | No observed task at least 50 ms; maximum sampled live renderer heap 25,655,588 bytes; warmed closed growth 432,724 bytes; zero remaining workers after each close |

The unchanged 100 ms blocking, workspace-readiness, complete-tree, transfer and
retention assertions all passed. The new audit benchmark measures the entire
file-import, complete-drawing, insight-navigation and export-preparation interval,
not just export completion. Worker calculations, exact JSON serialization and
HTML/CSV/SVG preparation do not run on the main thread.

Earlier verification attempts remain relevant. The first expanded browser run
passed 39 cases and skipped two but failed the new audit gate at **127 ms**;
that task preceded the first worker progress message. Its in-memory upload
fixture was replaced with a temporary-file upload, consistent with the existing
performance suite and native file-opening journey. The isolated six-case audit
rerun and final complete run passed without raising a threshold or dropping
coverage. This does not establish host load or upload instrumentation as the
sole cause of the earlier failure. Benchmark traces omit full-DOM snapshots/
screenshots, as existing performance cases do; functional checks retain them.

The default unit run had one progressive-drawing wait failure; a bounded-fork
repeat also had worker-startup and test timeouts. No test deadline was relaxed.
The final full run, `npm test -- --pool=threads --maxWorkers=2 --reporter=dot`,
passed **209 tests across 28 files**, with the same assertions. It includes
extreme/subnormal numeric ranges and exact lower-inclusive histogram-boundary
regressions. All **47 server tests** passed with mocked providers. TypeScript,
the expanded subpath smoke (including analytics and worker audit preparation)
and the restored root production build passed afterward. Scoped helpers stopped;
the existing credential-configured host was preserved and served the root build.

These are fresh Chrome/synthetic/mock checks, not a private-corpus rerun,
live-provider acceptance, cross-browser/device guarantee, manual screen-reader
evaluation or full v6.4/Pega scoring certification.

## Fullscreen, definitions and evolution follow-up

Native diagram fullscreen reuses the existing drawing and keeps complete scope,
manual collapse, selection and camera state. Desktop Escape and the explicit
exit button restore focus; a separate narrow layout keeps the map and
scrollable node-details/text-outline panel available. Unsupported/denied
fullscreen produces visible errors. Inline metric disclosures and a keyboard-
operable glossary distinguish ensemble, selected-tree and drawing scopes.

Evolution imports use separate summary-only workers, never transfer forests
into the series, and terminate after completion/rejection/cancellation.
Production Chrome checks exercised unordered multi-file imports, exact-byte
duplicates, malformed files, missing metrics, actual elapsed-time chart spacing,
non-interpolated gaps, UTC correction in an America/New_York browser timezone,
duplicate-time blocking, predictor changes, removal/clear/reload, cancellation
with retained successes, and the open occurrence worker/profile/AI remaining
intact. Native desktop/mobile fullscreen and expanded controls were exercised;
screenshots were inspected. Automated axe A/AA checks passed on fullscreen and
desktop/mobile comparison surfaces. These are headless Chrome/emulated viewport
checks, not manual screen-reader or physical-device certification.

**Final local acceptance passed after the rendering follow-up.** The complete
production Chrome run passed 34 checks, with two unconfigured private-corpus
cases skipped. All seven fullscreen/evolution journeys, axe checks, lifecycle
retention checks and unchanged timing gates passed together. The 132,990-node
forest completed its import/drawing journey in 1,470 ms with no observed task
at least 50 ms across import/editor/edit. The complete 8,191-node tree,
4,096 leaves and 8,190 links remained mounted; its import/editor maximum was
51 ms. The five-cycle lifecycle had no observed task at least 50 ms, maximum
sampled live renderer heap 25,077,136 bytes, warmed closed growth 435,728 bytes,
and zero remaining analysis workers after every close. These are bounded
synthetic measurements on this host, not universal device or corpus guarantees.

Profiling identified a synchronous workspace-plus-layout mount and growing
layout/visibility work during progressive drawing. Large diagrams now mount
in a separate task from workspace initialization. Outline visibility is
contained per 32-entry ordered-list batch instead of per entry; every entry
remains available, with continuous numbering and no node cutoff. The lifecycle
benchmark now uses scoped editor controls and the same snapshot-free action
tracing as the performance suite: full-DOM trace snapshots and whole-document
selector scans were adding benchmark overhead. Functional UI tests retain
normal snapshots. No timing threshold, readiness timeout, heap budget,
required tree count or worker-retention assertion was relaxed.

**Earlier attempts did not pass.** The first full Chrome run passed
30 cases, skipped the two unconfigured private-corpus cases, and failed three
existing large-model gates: a 110 ms task in the five-cycle lifecycle case,
the unchanged five-second workspace readiness timeout, and a 551 ms maximum
task with the complete 8,191-node tree. An isolated rerun without general DOM
snapshot tracing passed the 132,990-node forest's 100 ms gate (maximum 93 ms;
4,985 ms through complete drawing), but still hit lifecycle import readiness
and a 231 ms high-cardinality task. A separate diagnostic CPU timeline recorded
long JavaScript rendering callbacks, layout and garbage collection; profiling
itself is additional overhead, not acceptance evidence. Shared-host timings
varied substantially; these historical failures are not attributed to host
load alone. A later pre-fix repeat passed the forest and high-cardinality
checks but failed lifecycle at 124 ms; after bounding lifecycle instrumentation,
the high-cardinality case still failed at 156 ms before the rendering changes.

The final complete unit/component run passed 198 tests and TypeScript.
Exact duplicates can explicitly be kept as separate
observations, with no guessed date and a required actual UTC time for trends.
Private exports and live LLM inference were not used; AI regression transports
were mocked.

The final expanded-glossary workspace journey and subpath hosting smoke passed;
the latter also exercised fullscreen and snapshot comparison. TypeScript and
the root production rebuild passed afterward. Functional hosting acceptance is
separate from the measured responsiveness checks above.

## Complete-tree display, 2026-10-15

The owner chose complete selected-tree diagrams, including large trees, rather
than automatic depth collapse or the former 127-node cutoff. Subtree focus and
collapse are now explicit actions; Root restores the fully expanded tree.
Deep trace/occurrence selection keeps the whole tree in scope. Fit uses both
viewport dimensions and can zoom below 15% so the entire scope fits.

Large drawings append small memoized batches without discarding nodes. Each
batch has its own bounded SVG viewport within one continuous, scaled map,
avoiding repeated layout/paint of one giant SVG. The diagram reports progress
until every node is drawn. The text outline retains every entry, with browser
offscreen-rendering optimization. CSS containment and content visibility keep
profile navigation from restyling the entire inactive drawing. Larger trees
still take longer and use more browser memory; this is not an unlimited-size
or cross-device responsiveness guarantee.

The initial all-at-once implementation failed the existing 100 ms gate.
A later repeat found a 104 ms initial-mount task; large drawings now yield
before their first batch, separately from workspace initialization.
Profiling also identified trace snapshot traversal and whole-document test
queries as benchmark overhead. Performance cases now retain action/network
traces without DOM snapshots/screenshots, use scoped controls, and wait for
complete drawing before collecting the full import interval. Other UI cases
retain their normal trace configuration. No duration threshold or required
tree count was relaxed.

Fresh Chrome acceptance passed all 11 AI/accessibility/performance cases.
The 33-node fixture now draws all 33 nodes and 17 leaves. The 132,990-node
forest draws all 1,023 nodes of its selected tree; no >=50 ms task was recorded
across the final import/editor/edit interval.
The high-cardinality case draws all 8,191 nodes, 4,096 leaves and 8,190 links,
with a maximum recorded 75 ms task through import, complete drawing and editor
opening. These measurements use generated fixtures, not private models or
real provider inference. All 26 targeted layout/diagram/workspace/explanation
tests, TypeScript/root build and the subpath-hosting smoke also passed.
Earlier collapsed-view results below are historical.

## Whole-model commentary rerun, 2026-10-14

The additional full-model evidence pass remains in the import worker, not on
context selection/profile editing. Production Chrome and Edge each passed
10 targeted AI, axe, privacy and unchanged performance cases. A longer exact-
request preview revealed an actual keyboard-inaccessible scroll region in the
first run; focusability and an accessible region label fixed it without rule
exclusions. AI provider transports were mocked, never real inference.

Both owner-supplied private exports also passed five local import/edit/close
cycles each with AI credentials disabled and external evidence storage. Initial
RBO/Web imports took996/470 ms; real changed-route edits85/77 ms; no >=50 ms main-
thread task was recorded in their import/editor/edit intervals. RBO worker parse/
analysis took285.2/113.4 ms and Web119.4/63.6 ms, including the new full-model
aggregation. These are shared-host observations, not universal guarantees or
secure-erasure measurements; the existing exact100 ms/5-second and bounded
retention assertions remain unchanged. Earlier results below are preserved.

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
technology remain manual/external gates. At that historical checkpoint AI was
local scaffolding only: the retired provider was hard-blocked and no live inference
request was made. The subsequent owner-approved Anthropic integration is recorded below.

### Copilot-default regression acceptance, 2026-10-14

SDK provider selection does not move deterministic analysis into AI. Chrome
full production25/25 and separate private2/2 (five cycles each), Edge targeted
AI/axe/privacy/performance/journeys20/20, and Edge local-subpath1/1 passed.
All four axe surfaces include the default-provider consent preview; the mocked
real-HTTP journey checks keyboard approval, plaintext output, provider switching,
separate profile consent, safe rate failures/cancel and no external browser egress.

The unchanged100 ms blocking and5-second readiness gates passed. The public
132,990-node synthetic import/edit elapsed times were Chrome1014/129 ms and
Edge1005/138 ms, with no observed >=50 ms task in either. The4,095-predictor
checks also observed no >=50 ms task. These are shared-host measurements, not
universal hardware guarantees. Historical156 ms/isolated-timeout evidence is
not overwritten. No live inference or private provider transfer occurred;
SDK non-inference startup/auth-status/stop was separately verified without auth.
Physical-device, actual screen-reader/zoom and independent-engine gates remain.

### Subsequent Anthropic integration regression check, 2026-10-09

The unchanged production Chrome performance gate passed after adding the optional
loopback commentary flow. For the 132,990-node synthetic model, import was
**1,043 ms** and the real changed-value edit **155 ms**, with no observed >=50 ms
task across the recorded interval. The 4,095-predictor case observed a maximum
**55 ms** task. Five synthetic import/edit/close cycles passed the same declared
retention and 100 ms budgets; import durations were 1,019–1,593 ms.

Both private exports then passed five Chrome cycles each with no configured
Anthropic key and no provider transfer. RBO imports were 910–993 ms, edits
72–75 ms; Web imports 297–979 ms, edits 64–85 ms. No >=50 ms long task was
observed in either repeated record, and every close had zero workers. Private
payloads, identifiers and detailed evidence stay outside the repository.
These results do not erase historical failures or establish universal device,
peak/RSS, secure-erasure or Pega-oracle parity.

All four axe surfaces and actual keyboard/reflow/reduced-motion journeys passed
in Chrome and Edge; the mocked Anthropic success/error/cancel browser journey
also checks the enabled consent/output surface. Cloud commentary is now an
explicit consented exception, never a source of deterministic calculation.
No real provider request or real API key was used. See `AI.md` and the subsequent
acceptance record in `RELEASE_READINESS.md`.

- Automated axe WCAG A/AA scans cover start, exploration, and open profile editor in a real production browser.
- Trace labels previously measured 3.56:1 at 9 px; contrast and type sizes were corrected and real-browser scans cover them.
- Keyboard activation, initial workspace-title focus, repeated occurrence selection, blocked-feature edit focus, exact selected-node reveal, and a synchronized textual outline are regression-tested.
- Browser journeys cover 320, 390, 768 and 1440 CSS px, page reflow and reduced-motion preference. These are emulated viewports, not physical device certifications.
- Branch meaning is textual (True / Left, False / Right), not color alone. Inputs expose invalid states/descriptions; global blockers link to the stage and field.

Automated scans do not establish complete WCAG conformance. Manual screen-reader review, zoom/reflow on assistive technology, physical device/browser coverage, and practitioner/non-expert usability review remain external release checks.
