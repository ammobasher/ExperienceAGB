# Deployment and release readiness

## Current release scope (2026-10-14)

The owner approved release as a **local-only exploratory tool with unverified scoring previews**, publication of the **existing bundled demonstration sample only**, and commit/push of the completed changes. This is not permission to publish customer exports, profiles, actual identities, private research or test evidence, approve provider terms, or declare scoring/accessibility/security certification. Private-core access and independent Java parity are not implementation blockers for this accepted preview. The earlier baseline was published as `50efd345ca8e77f465c9edac2e64e7b7016a19b0`; [hosted CI passed for that baseline](https://github.com/ammobasher/ExperienceAGB/actions/runs/37745532116). That old hosted run does not cover this release's changes; publication and subsequent CI are recorded in Git/GitHub.

The owner authorized the loopback backend, then selected **GitHub Copilot SDK/local CLI as default** on October14 with **Anthropic explicitly selectable**. Copilot uses `auto`, strict per-request isolation and an explicit server-only `COPILOT_GITHUB_TOKEN`; it does not silently use ambient GH_TOKEN/chat/stored-login identities. Anthropic uses server-only `ANTHROPIC_API_KEY`. Every cloud request needs exact application-message/disclosed runtime-addition and separate numeric-profile consent. New AI changes are **uncommitted/unpushed**; earlier publication authorization is not automatic new permission. Tests use mocked SDK/upstreams, not real credentials/private transfers. No silent fallback or retired GitHub Models endpoint.

Historical results below are dated records. In particular, the publication rerun found a synthetic **156 ms** main-thread task against the unchanged **100 ms** target and an isolated 5-second workspace timeout. Earlier green runs do not erase those results. The new acceptance record must document the root cause, changed behavior and fresh measurements rather than weakening the target.

## Run the approved local-only build

Use Node.js 24 and `npm ci`, then `npm run build` and `npm run start:local`. The integrated host binds only to `127.0.0.1:5183` and serves built assets and bounded commentary routes. With no server key, local analysis works and AI fails explicitly as unconfigured. See `AI.md` for masked local key setup and dev proxy configuration. Trusted-device loopback HTTP is the approved scope; do not bind to `0.0.0.0`, expose a LAN/public tunnel or upload private exports.

For a subpath deployment, build with the chosen base:

```powershell
npm run build -- --base=/ExperienceAGB/
```

The brand link and bundled sample honor Vite's base URL. Verify sample/worker loading and return-to-home under the actual production base before release. Do not upload users' model files to the hosting service.

The browser allows only its own scripts, styles, worker, sample and local API (`worker-src 'self'`, `connect-src 'self'`). Only the server/owned SDK runtime may reach the selected provider after approval. Copilot uses the official SDK managed routing; Anthropic its fixed Messages endpoint. No browser egress exception, arbitrary proxy or silent/retired-provider fallback. Development HMR is not a production requirement.

`scripts/preview-host.mjs` remains the static-only reference host; `scripts/ai-host.mjs` integrates its CSP, `nosniff`, no-referrer, denied framing, permissions restrictions and asset containment with strict Host/Origin/CSRF/JSON commentary boundaries. Inline **styles** support existing React/SVG layout, not inline scripts/eval. The static-only host has no upload route; the integrated host has separately consented complete-model explanation and redacted-context routes, not a general upload/proxy service. Neither has an SPA fallback disguising missing assets. `npm run test:server` checks local boundaries; the hosting smoke checks `/ExperienceAGB/` sample/worker/home and local AI configuration under these headers. Restore `npm run build` afterward for the normal base.

This is a local exploratory release, not a public production deployment. HTTPS/HSTS and a public-host policy are not required claims for approved loopback HTTP. Any future remote hosting requires separate authorization and review of TLS, headers, privacy, MIME/asset routing and permitted AI egress. Do not add HSTS to loopback and mistake it for an HTTPS check.

## Repository checks

The Actions CI configuration checks install, units/components, TypeScript, reference-host boundaries, production build and serial production-browser E2E/axe/performance plus subpath-hosting cases. It uploads browser evidence even on failures. Hosted CI passed for the published baseline; changed-source local acceptance and a later publication's hosted CI are distinct.

## v6.4 structural analytics follow-up, 2026-10-15

The authorized attachment-review integration is implemented locally: linked
Model insights, availability/provenance-aware metrics, literal namespaces,
predictor gain/frequency/Pareto, tree-order diagnostics, threshold/membership/
missing-check evidence, depth heatmap, all-leaf density and descriptive review
candidates. Evolution now compares gain shares/ranks, namespaces, threshold
histograms and observed-category set hashes. Explicit local audit downloads
include exact metric/figure evidence and source hashes in script-free HTML or
JSON with CSV/SVG. No Python, Plotly, CDN or new runtime dependency was added.
Complete diagrams, fullscreen, explicit cloud consent and one bottom AI panel
are preserved.

The current AI contract is **`agb-v6.4-local-evidence-v5`**, evidence
**`whole-model-v2`**. This supersedes older current-contract descriptions below.
The compact v6.4 adaptation replaces sending the archived v6.3 instructions;
the original reference text remains unchanged. Consultant/technical presentation
and local predictor-slot resolution do not request another inference. Existing
credential-configured bridges must be restarted and models reopened before the
new contract can be used; old approvals are not migrated.

| Fresh local check | Result |
|---|---|
| `npm test -- --pool=threads --maxWorkers=2 --reporter=dot` | 209/209 units/components across 28 files |
| `npm run test:server` | 47/47 HTTP/SDK/static-host checks; providers mocked |
| `npx playwright test --reporter=line` with Chrome and `E2E_PORT=5194` | 40 passed, two unconfigured private-corpus cases skipped; desktop/mobile audit, AI, evolution, fullscreen, accessibility, privacy, errors, responsiveness and lifecycle |
| `npx playwright test --config=e2e\hosting.config.ts --reporter=line` | Subpath sample/workers/fullscreen/evolution/insights/audit preparation/home passed with no CSP violations |
| `npm run typecheck`; final `npm run build` | Passed; root base restored after the subpath build |

Final maximum observed main-thread tasks were 78 ms for the new 4,095-predictor
insight/export journey and 53 ms for the existing complete-tree/editor case.
The forest/edit and five-cycle lifecycle intervals had no task at least 50 ms.
No performance, readiness, heap or required-node threshold was relaxed.
`PERFORMANCE_ACCESSIBILITY.md` preserves the earlier 127 ms audit failure and
fork-runner failures, the subsequent checks and exact measurement limits.
Browser evidence/downloads and runner logs remain outside the checkout.

The user-configured 5183 host was not restarted and no credential or live
inference was used; its root GET serves the new build. Verification helpers on
5182/5194 stopped. These changes remain uncommitted/unpushed. No fresh private
corpus, Edge/physical-device/manual-screen-reader or live-account acceptance is
claimed. The full v6.4 execution regime, calibration/causal/health conclusions,
tree continuity/retirement and independent Pega scoring certification remain
explicitly unsupported, not implied by these structural views.

## Fullscreen, terminology and local evolution follow-up

The new UI adds native diagram fullscreen, metric-scope/technical-term
disclosures, and local multi-export structure/training-metadata comparisons.
Comparison membership is user-confirmed rather than inferred; chronology uses
validated export times or explicit manual UTC times. Missing metrics remain
unavailable, duplicate times pause trends, and identical unchanged exports can
explicitly be retained at distinct observation times. No snapshot data is
added to the model's AI request or persisted. These changes are not committed
or pushed, and do not alter the server credential contract.

The new feature journeys passed desktop/mobile Chrome checks, including axe,
keyboard exit/focus, actual summary workers, UTC handling, charts/predictor
changes, cancellation, local-only behavior and preservation of the active
model/profile/occurrence worker/single bottom AI panel. The final full unit run
passed 198 tests and TypeScript. The final complete Chrome regression passed
34 checks and skipped two unconfigured private-corpus cases, including passing
all unchanged synthetic performance and lifecycle gates. The forest interval
and five-cycle lifecycle had no observed task at least 50 ms; the complete
8,191-node tree's maximum was 51 ms against the 100 ms target.

Earlier attempts failed timing gates (initially 30 passes, two skips and three
failures). Profiling prompted separate-task large-diagram mounting and batched
outline visibility instead of thousands of individual visibility checks.
Lifecycle benchmark selectors/tracing were also bounded consistently with the
performance suite, without changing thresholds or required coverage.
See `PERFORMANCE_ACCESSIBILITY.md` for historical failures, fresh measurements
and limitations; these local results are not universal performance guarantees
or fresh private-corpus/live-provider acceptance.

Final follow-up checks also passed the expanded-glossary workspace journey
(including axe and preserved model/profile state) and the reference subpath
hosting smoke with fullscreen and snapshot comparison. TypeScript and the root
production rebuild passed after the subpath run, restoring the normal local
host base. The configured user host was preserved; no real inference was sent.

## Copilot-default acceptance, 2026-10-14

### Latest display decision: complete tree in scope, October 15

The owner selected complete diagrams even for large trees, using scrolling
and zoom rather than automatic depth collapse or a 127-node cutoff. Every
node/leaf in the selected tree or explicitly focused subtree is drawn.
Manual collapse remains optional; expanding restores the full subtree and
Root restores the complete tree. Deep trace/occurrence navigation does not
automatically narrow the scope. Fit covers the full scope without a 15%
minimum zoom. Large drawings load progressively with visible progress, using
small independently contained SVG batches, not a hidden node-count limit.

Fresh production Chrome acceptance passed all 11 AI/accessibility/performance
cases, including the complete 33-node/17-leaf view, manual collapse, subtree
focus, fit, mobile occurrence focus, axe and model-stable AI output. The
performance cases wait for complete selected trees of 1,023 and 8,191 nodes.
The final 1,023-node import/editor/edit interval recorded no >=50 ms task;
the 8,191-node interval peaked at 75 ms against the unchanged 100 ms gate.
All 26 targeted unit/component tests, TypeScript/root build and the subpath
hosting smoke passed. A repeated 104 ms first-mount regression was addressed
by yielding before the first large drawing batch. Benchmark-only DOM snapshot capture is disabled after profiling
identified it as measurement overhead; normal UI tracing remains enabled.
See `PERFORMANCE_ACCESSIBILITY.md` for the failed initial approach and scope.
No private input or real provider inference was used; no server credential or
backend contract changed. Earlier collapsed-view records below are historical.

### Earlier workspace follow-up: one AI panel and explicit tree counts

The owner reports the evidence-only explanation now works. This is a user
report, not another agent-run live inference. The workspace now exposes only
the whole-model explanation, below the explorer/trace. The legacy
selected-context contract remains internally tested, without a second UI panel.
Tree facts identify full-tree totals; the diagram separately reports shown
nodes and actual terminal leaves, hidden counts, and collapsed/focused scope.
Collapsed splits are not counted as leaves. Fit changes zoom, not expansion.

Fresh acceptance for this frontend change: 22/22 targeted App, TreeDiagram and
FullModelExplanation tests; TypeScript and root production build; 11/11 Chrome
AI/accessibility/performance cases; 1/1 subpath-hosting smoke, followed by a
restored root build. The generated 33-node/17-leaf fixture shows 13 nodes and
3 leaves initially, 19/7 after expansion and 7/4 when focused; Root restores
the initial overview and Fit preserves counts. The 390 px layout, axe checks,
6 MiB evidence journey and existing performance gates passed unchanged.
Browser provider responses were mocked; no private export or real provider
request was used. This frontend-only update retains contract v4 and needs a
page refresh/model reopen, not a bridge restart or another token entry.

### Latest input-strategy decision: whole-model evidence, October 15

The owner reports a 6 MB export still fails with generic SDK `session-error`.
A separately and explicitly approved live diagnostic using the complete original
prompt plus a 144-byte synthetic model succeeded and displayed its reply
(`1c245c9620a5`, 97,059 ms total, about 66 seconds of inference). This establishes
that small-input path only, not private-model acceptance or the cause of the
generic failures. No exact token count or routed-model context limit was measured.

The owner then selected local whole-model analysis and bounded computed evidence
sent to the LLM, replacing the former raw-file transfer mode. The import worker
already computes evidence over every accepted tree/node. The model-level panel
now uses that result with the original prompt preserved verbatim as reference;
raw JSON/names/categories/thresholds/metadata identifiers/profile are not sent.
Evidence is capped at 16 KiB and the complete request at 128 KiB. The server
independently validates evidence and rejects raw-file envelopes and old approvals.
The complete original-prompt audit execution regimes remain unfulfilled; supplied
numbers can be cited, unsupported outputs stay PENDING EXECUTION.

Current contract `agb-v6.3-local-evidence-v4` requires a credential-configured
bridge restart and model reimport. No credential is extracted to restart it,
and no private request or additional live diagnostic is sent automatically.
The older acceptance records below are historical, not the current input contract.

Current local acceptance for this change:

| Check | Result |
|---|---|
| Units/components | `npm test -- --maxWorkers=2`: 166/166, including the generated 6 MiB forest, last-tree evidence sensitivity, maximum-depth bounds, missing evidence and model-stable consent/output |
| HTTP/SDK/static host | `npm run test:server`: 47/47; raw/extra-field/old-approval rejection, bounded evidence, output/truncation, isolation and cleanup. Deadline-stage fixtures now advance controlled timers only after admission/inference, without changing application deadlines |
| Types and root production build | Passed `tsc -b` and Vite production build; normal root base restored after subpath test |
| Chrome production UI | 10/10 combined AI/accessibility/performance checks, plus 1/1 subpath-hosting smoke; real local HTTP with mocked providers, actual payload download, keyboard and fresh consent, errors/cancellation, plaintext output, model-level persistence, 390 px evidence reflow and axe |
| Generated 6 MiB journey | 6,296,340 input bytes; all 176 trees / 89,936 nodes analyzed locally; 2,576 evidence bytes; 81,381 complete-request bytes including original prompt; maximum observed >=50 ms task in the explanation interval: 84 ms, below the unchanged 100 ms gate |
| Regression performance | Existing 132,990-node import/edit and high-cardinality budgets passed unchanged |
| Live account/private data | Not exercised for the new evidence-only contract; no new credential, provider inference or private transfer used |

The first negative upload check encountered a Windows reset while writing a
multi-megabyte body to an already-rejected connection. Header/chunked admission
checks still enforce the reduced body limit; header rejection fixtures send a
minimal body instead of depending on that race. No application safety or
performance thresholds were relaxed. New changes remain uncommitted/unpushed.

### October 15 live diagnostic follow-up

After repeated full-model session errors, the owner approved exactly one
synthetic request through the existing one-request UI consent controls.
The generated one-leaf model's small commentary passed response validation,
but the reply was withheld by state-removal failure. No private export/profile
was used, no retry was automatic, and the complete full-model flow remains
unverified. Current source corrects a separately reproduced cleanup-budget
defect: state removal may use the time left in the existing 50-second cleanup
allowance instead of failing after five seconds with unused budget. Exhaustion
still withholds the reply and quarantines Copilot; inference/browser deadlines
and provider/tool/privacy boundaries are unchanged. See `AI.md` for exact
diagnostic scope, local-only actual-SDK probes and remaining limitations.
The chronological acceptance records below describe their dated state, not
verified live full-model success. New source remains uncommitted/unpushed.

### Complete-model explanation follow-up

The owner's new request adds a separate explicitly approved complete-model LLM
explanation at the model overview, using the exact original v6.3 prompt and
full imported JSON. Redacted contextual commentary remains separate. The
original prompt's no-execution regime is disclosed; this is not a complete
executed audit or scoring certification. Raw exports may now leave the device
only through this newly consented mode; previous redacted-only privacy statements
describe the earlier mode, not this new route.

The newest owner-run attempt passed response checks but its answer was withheld
by cleanup failure. Supported disconnect/graceful shutdown, finite state-removal
waits and a visible alert address the diagnosed lifecycle/UX defects. Mocked
acceptance cannot establish that the owner's real runtime now completes cleanup
or that a full production export fits the account's selected model context.
No real request is replayed automatically. New source remains uncommitted/unpushed.

Latest local acceptance: 166 unit/component tests across 25 files; TypeScript;
36 loopback/SDK/static-host tests; 10 Chrome and 10 Edge production checks
including both mocked providers, full-file keyboard consent, cancellation,
plaintext output, persistence across tree changes, axe and unchanged 100 ms /
5-second performance gates. Both ordinary and worst-case escaped 25 MiB model
uploads were admitted intact in HTTP mocks. Original prompt integrity is checked
against its SHA; its source content is not replaced with the earlier adaptation.

Fresh independent security review and incremental follow-up found no
vulnerabilities. Correctness review found SDK truncation/completion metadata
could allow partial output and a Windows-only fixture path could break Linux CI;
regressions/fixes were applied and follow-up found no significant issues.
Browser acceptance also exposed excessive layout work for the complete 74 KiB
prompt preview; bounded instruction paging fixed it without truncating provider
input or relaxing the 100 ms gate. Dependency audit and intended-source/private
data scan found no issues.

The currently running owner-configured 5183 bridge remains the older v2 process,
blocked after its cleanup failure; its credential was not read or transferred.
It needs a user restart with masked local credential entry and a page refresh /
model reimport before the v3 flow can be used. Automated mock acceptance is not
a successful live-account or private-model validation.

### Later v6.3 whole-model commentary acceptance

The attached audit prompt is a labelled **commentary adaptation**, not a complete
Sections 0-13/Python/HTML audit executor. Every accepted tree/node contributes
locally computed, bounded evidence alongside the selection. Raw exports and
source feature names still stay local; monitoring/gain/structural aggregates can
be sensitive and remain subject to exact per-request consent.

| Check | Result |
|---|---|
| `npm test`; `npm run typecheck` | 149/149 units/components across 22 files; TypeScript passed |
| `npm run test:server` | 20/20, including exact reconstruction, both mocked providers and HTTP security/cleanup |
| Chrome / Edge production AI/axe/performance/privacy | 10/10 each; production builds passed, unchanged <=100 ms and 5-second gates passed |
| Local private corpus rerun | 2/2, five import/edit/close cycles per export, credentials disabled, screenshots/traces off and evidence outside the checkout |
| Independent security review | No vulnerabilities found in expanded evidence/prompt/consent changes |
| Independent correctness review | Decimal accumulation could exceed a share of one and crash an optional panel; failing regressions captured, negligible overshoot normalized, optional contract errors isolated with explicit no-send status; follow-up found no significant issues |
| Intended-source/private-data scan | 90 intended files, 19 ignore probes, two private identities/hashes, zero findings |
| Production dependency audit | Zero vulnerabilities |

The first production run exposed a real keyboard-accessibility defect in the
now-longer exact-payload preview. Its scrollable region was made focusable and
labelled; both axe failures resolved in the Chrome/Edge reruns. No axe rule,
request-byte budget, import bound or performance target was weakened.
All new changes remain uncommitted/unpushed; live inference was not exercised.
The owner's credential-configured5183 process was preserved. Its old contract
requires **user restart in the configured terminal**, then refresh/reopen the
model; credentials were not read, extracted or silently transferred.

### Earlier provider acceptance

**Later timeout investigation:** Existing user-run terminal logs had startup only;
the actual stalled phase was not retrospectively available. The20-second total
SDK/runtime budget was replaced with a bounded90-second budget and100-second
client deadline, preserving cancellation, body3 seconds, concurrency2 and no
automatic resend. Added privacy-safe enum/timing-only phase/result diagnostics
and a status deadline handshake; the user's keyed process is not restarted or
its credential extracted automatically.22 server tests,17 targeted UI/contract
tests, TypeScript and7 production Chrome AI/axe journeys passed after red
regressions. A fresh independent security review found no vulnerabilities.
Real provider response success is still unverified; next retry requires consent.

**Later owner-run cleanup investigation:** New fixed logs showed two sessions
reaching generation, then leaving it at about30 seconds and failing cleanup.
The generic provider message had masked cleanup. Captured failing regressions
for abort skipping graceful stop, non-quarantined cleanup failure and a30-second
SDK idle expiry conflicting with the90-second request policy. Graceful stop is
now still attempted after abort/delete failures; native exact-state removal has
bounded Windows retries; unrecoverable cleanup is explicit503 and lifetime
Copilot quarantine (also after timeout); frontend disables sending and contract
revisionv2 detects older bridges. SDK idle expiry is100 seconds while the hard
request deadline remains90. The timing supports an idle-expiry hypothesis, not
verified provider success. Two verified request-state directories were removed
without reading contents; unrelated temporary directories/user files preserved.
Mock-only24 server tests,18 targeted UI/contract tests, TypeScript and7 production
Chrome AI/axe journeys passed; independent security review found no vulnerabilities.
User credentials/process were not extracted/reconfigured, no inference was
resent and new changes remain uncommitted/unpushed. Restart/reopen and a separately
approved live retry remain manual validation.

All AI source changes remain uncommitted/unpushed. SDK 1.0.21/runtime1.0.97
is pinned. The installed bundled runtime also started with isolated empty
configuration, reported **unauthenticated**, and stopped/removed its temporary
state without any inference request. Status and the Vite proxy report the
Copilot default, both credentials unconfigured, and both local pages return 200.
Existing Vite5178 was preserved; the owned integrated5183 host was refreshed.

| Check | Result |
|---|---|
| `npm test` | 135/135 units/components, 20 files |
| `npm run test:server` | 20/20 actual HTTP/static/SDK-mock tests: status/no inference, explicit dispatch/no fallback, Host/Origin/CSRF/body limits, safe errors, startup/auth/create late rejection, stream/tool guards, timeout/disconnect/shutdown and owned-state cleanup |
| `npm run typecheck`; `npm run build` | Passed; restored normal-base production build after subpath smoke |
| Chrome full production suite | 25/25 public tests; two private cases skipped in the ordinary suite, then 2/2 passed separately, five cycles each with AI credentials disabled |
| Edge targeted AI/axe/privacy/performance/journeys | 20/20; not an independent browser engine from Chrome |
| Edge integrated `/ExperienceAGB/` smoke | 1/1; worker/sample/home/local status/CSP checked |
| Exact performance gates | Unchanged <=100 ms task and 5-second readiness assertions passed in Chrome/Edge. 132,990-node synthetic import/edit: Chrome1014/129 ms, Edge1005/138 ms elapsed; neither observed >=50 ms tasks. 4,095-predictor checks also observed none. Elapsed edit time is not main-thread blocking time |
| `npm audit` | Zero vulnerabilities, including all installed development dependencies |
| Intended-source/privacy scan | 85 intended files, 19 ignore/inclusion probes, two private identities/payload hashes; zero findings |
| Fresh independent security review | No vulnerabilities found; telemetry observation resolved by removing the SDK telemetry object and explicitly disabling child OTel/content capture |
| Fresh independent correctness review | Early-cancel unobserved SDK promise and ambient default-transport override fixed with failing regressions, then green. Follow-up confirmed both resolved and no significant remaining coupled issue |

The first Copilot browser run failed a mock abort-count assertion: rate failures
now correctly abort their owned session as well as explicit cancellation. The
test count was corrected; full Chrome/Edge reruns passed. No live entitlement,
inference quality, provider retention guarantee, physical-device/assistive-
technology certification or independent Pega scoring parity is established.
Historical synthetic156 ms and isolated5-second failures below remain visible.

## Local acceptance records, 2026-10-09

### Subsequent Anthropic integration acceptance, 2026-10-09

This record supersedes earlier AI deferral/scaffolding status, not historical
results or scoring-certification limits. The feature is uncommitted/unpushed.

| Command / scope | Result |
|---|---|
| `npm test -- --maxWorkers=1` | 131/131 units/components, 19 files, on final source |
| `npm run typecheck`, `npm run build` | Passed; normal `/` build restored |
| `npm run test:server` | 9/9 actual local HTTP/static boundaries and transport lifecycle cases |
| Chrome production browser suite, `E2E_PORT=5280` | 25 passed; two private cases initially skipped, then both passed separately with approved paths and external evidence |
| Private Chrome corpus rerun | Both exports, five import/edit/close cycles each; all workers terminated; no Anthropic key configured or provider transfer |
| Edge selected AI/accessibility/journeys/privacy/usability specs | 20/20 after final judge corrections; real local HTTP backend with injected upstream, keyboard consent, safe errors/plaintext, cancellation and axe |
| Edge integrated `/ExperienceAGB/` host smoke | 1/1; assets/sample/worker/home, security headers and missing-key AI status honor the actual subpath |
| Development proxy / user-facing services | Existing 5178 preserved; local integrated 5183 HTTP 200. Status is explicitly unconfigured; correct Origin/CSRF proxy POST returns configuration 503 before provider networking |
| `npm audit --json` | Zero reported vulnerabilities; no new dependency installed |
| Intended-source privacy/secret scan | 81 files, 19 ignore/inclusion checks, both private identities/normalized payloads checked; zero findings, including Anthropic-key pattern |
| Fresh independent security judge | No vulnerabilities reported in the actual new backend/frontend integration scope; not formal certification |
| Independent final correctness judge | Two findings fixed: open-ended non-JSON body cleanup reproduced failing, then cancelled/aborted on every exit with regression; explicit Vite 5178 strict-port instructions now match approved development Origin. Follow-up confirmed both resolved |

Shared contract and bridge tests failed before implementation; all five new UI
cases failed against the retired-provider UI before it was replaced. The
open-ended body cleanup failure was independently reproduced and corrected, not
hidden by a timeout increase. No real Anthropic inference/key/private payload was
used. Core browser main-thread/readiness limits remain unchanged: large synthetic
import **1,043 ms**, real edit **155 ms**, no observed long task >=50 ms in that
interval; high-cardinality maximum **55 ms**. Both authentic five-cycle reruns
also observed no >=50 ms task and terminated every worker. These are measured
shared-host runs, not universal or independent-engine certification.

The visible local bridge terminal is deliberately left available **without a
key**, alongside the original dev server. Configure the key locally using the
masked procedure in `AI.md`, restart only that bridge, then review the exact
context and consent before any request. Actual key/model entitlement, live
response quality/billing, provider agreement, organization/customer data-sharing,
physical devices, screen readers and scoring parity remain separate manual gates.

### Earlier preview-hardening acceptance (before Anthropic integration)

| Command / scope | Result |
|---|---|
| `npm test -- --maxWorkers=1` | 128/128 units/components, 18 files |
| `npm run typecheck`, `npm run build` | Passed; default base restored after subpath smoke |
| `node --test scripts\preview-host.test.mjs` | 2/2 boundaries |
| `npm run test:e2e` with Chrome, approved private paths, external output and `E2E_PORT=5280` | 27/27; both original exports each repeat five import/edit/close cycles in one renderer |
| Edge selected journeys/accessibility/usability/privacy/AI specs | 20/20; four axe surfaces, actual Tab/focus/reflow/reduced-motion, no outbound AI or persistence |
| `npx playwright test --config=e2e\hosting.config.ts` with Edge | 1/1 real subpath sample/worker/home under reference security headers; no CSP violations |
| `npm audit --json` | Zero reported vulnerabilities; not formal security certification |
| Independent final source judge | No significant source-level blockers to accepted preview; security judge found no vulnerabilities in its reviewed scope |

The first integrated attempt exposed grouped-axe timeout and delayed-route
cancellation-fixture races; both were corrected without raising readiness or
blocking limits. A subsequent run lost its test server due port-5180 ownership
collision; isolated explicit port 5280 produced the complete green acceptance.
The hosting smoke initially used its config directory as cwd; explicitly resolving
the repository root corrected startup. These failures and red/green evidence
remain in external session artifacts. See `PERFORMANCE_ACCESSIBILITY.md` for exact
durations, retention budgets and limitations.

## Gate status

### Independent remaining-work judges (2026-10-09)

| Stage | Findings and disposition |
|---|---|
| Hosting/release correctness | Node-runner `.test.mjs` was accidentally discovered by Vitest (reproduced failure); excluded from that runner while retaining the dedicated Node/CI gate. Hosting failure traces/screenshots and upload directory were missing; added. CDP viewport/DPR emulation was mislabeled browser zoom; renamed and actual zoom retained as a manual check. |
| Performance/lifecycle correctness | Reducing tree pages to 25 exposed absolute-index pagination against a filtered list. Two failing regressions reproduced hidden/empty selected-tree navigation. Selection now pages by filtered position or explicitly clears an excluding filter; 10 App tests passed, and an actual-browser regression was added. |
| AI security | No vulnerabilities found in the reviewed context, consent, lifecycle, mock transport, selection integration and reference-header scope. The production guard returns before networking; historical transport is imported only by tests in the inspected source graph. Mocked AI tests passed. A concurrently run App test hit its 5-second deadline; that is an acceptance limitation, not a security finding. Fresh serial integrated acceptance remains required. |

Independent source review is not a complete organizational security audit. The security judge did not execute a production build/browser run or live provider request; production bundle/browser exclusion is checked separately. No real AI request is authorized by these tests.

| Gate | State |
|---|---|
| Conservative observed-shape canonical adapter, diagnostics, grammar/type limits and recovery | Implemented; bundled sample and two owner-supplied UUID-v4-tagged production exports pass local structural/browser checks; scoring remains unverified |
| Plain-language explorer, predictor/tree navigation, profile-state and incomplete trace guidance | Implemented; local checks plus actual user review remain distinct |
| No certified final score without independent oracle | Enforced: all calculated propensities remain visibly unverified previews |
| Ensemble formula / export learning-rate scaling | **Documented by Pega:** returned tree scores are summed, then sigmoid applied; export serialization already includes learning-rate scaling. Existing arithmetic agrees; no extra multiplier |
| Main-thread blocking target <=100 ms | Passed unchanged target and 5-second readiness assertion in repeated stage and final integrated/private checks. Final large synthetic 1,032 ms import, no >=50 ms task; high cardinality max55 ms; authentic repeated RBO/Web max61/51 ms. No universal hardware/corpus guarantee |
| Automated accessibility, keyboard/focus and viewport coverage | Implemented; not a substitute for manual assistive-technology certification |
| Persistent tests/CI/quick start/export matrix/glossary/privacy docs | Baseline published and hosted CI green; new changes need fresh acceptance/publication |
| Optional contextual AI | Copilot SDK default plus explicit Anthropic alternative implemented; isolated deny-tool runtime, server-only explicit credentials, exact application-message/disclosed runtime-addition approval, separate profile consent and safe cancellation/errors. Live account/quality/organization approval remain manual; no real provider request tested |
| Export/product applicability, exact input/routing and expected-score parity | **Open certification gate**, not a preview implementation blocker; documented formula and companion evidence supplied, independent expected-output fixtures are not |
| Actual performance corpus | **Locally supplied/tested:** 110-tree RBO and 130-tree Web, each five same-renderer import/edit/close cycles; all workers terminate, warm growth 0.137/0.134 MiB within provisional bounds. Broader corpus, peak/RSS/repeated worker heap/device matrix and redistribution remain open |
| Manual screen-reader, physical device and target-user usability review | **Open external release review**; installed-browser automated journeys are not physical-device or screen-reader certification |
| Dependency/security/privacy review, hosting and release approval | Local audit/scoped review and loopback hosting passed. Owner approved exploratory release with limitations, bundled-sample-only publication and commit/push; no formal certification or remote deployment approval |

Do not call this a certified Pega scorer, production-ready model approval product, complete WCAG implementation, or fully certified original plan. Certification requires source-attributed oracle fixtures with tolerances and explicit approval. The owner approved publication of the bundled sample only; this is not a general permission to redistribute supplied production exports or future samples.

## Optional provider live-account gate

The owner selected Copilot SDK as default and Anthropic as explicit alternative through the approved loopback bridge. Supported pinned APIs/auth/isolation, Messages contract and retention notices are linked in `AI.md`. Actual HTTP/mock SDK tests cannot establish real credentials, subscription/policy/model access, billing, provider availability or answer quality. A nonsensitive explicitly requested UI-consented user smoke and applicable organization/data-owner/terms approval remain open. No private exports or zero-retention claim.

## Local acceptance record, 2026-10-07

### Manual approval checklist still required

| Owner / review | Concrete acceptance evidence |
|---|---|
| Practitioner and non-expert users | Open an approved export, locate a predictor, explain a split versus a leaf, edit an illustration and recognize incomplete/unverified scoring without coaching. Record observed problems, not assumed satisfaction. |
| Assistive-technology reviewer | Actual NVDA/JAWS/VoiceOver keyboard journeys through upload, selected-node outline, trace states and AI consent/error announcements. Axe and programmatic focus checks do not establish this. |
| Device/browser reviewer | Actual 200% and 400% browser zoom, text enlargement, physical touch targets and at least one small physical device. CDP half-width/high-DPI emulation is reflow evidence, **not actual browser zoom**. Firefox/WebKit acceptance requires their real engines, not treating Edge and Chrome as independent engines. |
| Data/model owner | Bundled-sample-only publication approved. Private exports/evidence remain excluded; producing build and independent routes/scores are needed only for certification beyond this preview. |
| AI user / organization | Copilot-default/explicit-Anthropic loopback selected. Configure your entitled explicit server credential; review terms/retention/runtime additions and data-owner approval per transfer. A nonsensitive live UI-consented smoke remains unperformed. |
| Deployment owner | Local-only loopback hosting approved and checked. Any future public/LAN hosting, TLS/HSTS or external egress needs new approval and validation. |
| Release owner | Exploratory wording, unverified scoring, local-only hosting and bundled-sample-only publication approved. Copilot-default/Anthropic-alternative architecture authorized; new commit/push and certification are not automatic. |

Firefox 155 and WebKit 26.6 were missing locally on 2026-10-09. Both the combined Playwright restoration (which stopped at Firefox) and a separate WebKit restoration failed after CDN/mirror download timeouts. Installed Chrome and Edge can be exercised, but this limitation must remain explicit.

Final commands: `npm test` **77/77**, `npm run typecheck` **passed**, `npm run build` **passed**, `npm run test:e2e` **13/13**. The production browser checks cover upload/sample, adverse versions/fields/grammar/types/size, missing/invalid/unknown inputs, global blockers, repeated node/field focus, cancellation and network/worker failure with retry, no model/profile storage after reload, 320/390/768/1440 px keyboard/reflow journeys, axe start/explore/trace and both exact main-thread performance gates. Dispatching a native Worker `messageerror` is a synthetic fault injection, not proof of a naturally occurring deserialization fault.

| Independent gate | Findings addressed with regressions |
|---|---|
| Import/scoring judge | Quoted category whitespace, unbounded category argument spreading, nonfinite accumulation |
| Performance/accessibility judge | Unbounded high-cardinality predictor/profile DOM, repeated occurrence focus requests |
| Explorer/trace judge | Whitespace supplied-vs-missing semantics, repeated blocked-field focus, lost resolved prefix before a deeper blocker |
| Production worker/subpath acceptance judge | Native Worker `messageerror` required add/removeEventListener rather than an unsupported property handler |

The final judge independently verified exact 1,031-node reconstruction across 512/512/7 transfer chunks, 511 occurrences across 27 paged requests, exact path/tree/split identity, numeric equality/category whitespace/missing routes, cancellation/supersession/retry and postMessage-throw cleanup. The `/ExperienceAGB/` build served sample/worker/home correctly in installed Edge 154; the default build was restored afterwards. Its actionable finding was reproduced with a failing native-style unit test and real Chrome browser regression, corrected, and included in the final green suites.

TDD evidence is retained outside the repository in session artifacts: initial import group red (20 failing assertions plus the missing recovery component), import-judge red (4), phase-3 red (5 plus missing explanation module), phase-3-judge red (3), final navigation journey red (four viewport focus failures), worker failure red (2), and native-messageerror unit/browser red (1 each). Green logs and JSON/screenshot/trace evidence accompany them. These are local regression evidence, never source-attributed Pega oracle fixtures. An earlier broad acceptance run left browser artifacts but lost its agent report during a runtime interruption; it is not counted as an acceptance verdict.

At that historical checkpoint no scoped preview/debug helper was intentionally left running and source was uncommitted. Subsequently the baseline was committed/pushed and hosted CI passed; the user later requested a dev server, which remains at `http://127.0.0.1:5178/`. New source changes are not automatically published. Hosting and external approvals remain separate decisions.

## Production-export follow-up, 2026-10-07

The owner supplied two actual production exports as private attachments. Both initially failed only the `"2"` tag gate; a separate in-memory structural probe isolated this from other validation. The adapter now accepts the observed UUID-v4 tag format **only alongside full strict structural validation**, preserves the tag, and does not infer schema/scoring authority from it. Original attachments were not modified or copied into repository/public fixtures.

Tag preservation and honest UI provenance were reproduced red (2 failures) and corrected. A fresh independent code judge found that the private evidence destination guard incorrectly accepted an in-repository directory named `..private-results`. A failing containment test reproduced it; the separator-aware guard now runs both in the test and in Playwright configuration before artifact creation. The invalid configuration was also checked directly and rejected without creating that directory.

Final follow-up: **90/90 unit/component tests**, TypeScript/build passed, **15/15 production browser tests** with the two private paths enabled. See `PERFORMANCE_ACCESSIBILITY.md` for actual workload/heap measurements and `README.md` for opt-in private-run instructions. The two private cases are skipped by default; this is not a hosted private-corpus CI claim.

These files close the absence of a locally testable actual corpus and demonstrate this observed structural variant. They do **not** supply expected Pega routes/raw scores/propensities, establish live-CDH parity, authorize publishing production data, complete manual accessibility/security/privacy review or approve release. All those gates remain open.

## Official documentation follow-up, 2026-10-07

The owner supplied [Pega's The Gradient boosting technique](https://docs.pega.com/bundle/platform/page/platform/decision-management/adaptive-gradient-boosting.html). Its score-calculation section, also checked in the Platform '25 and '24.2 counterparts, establishes additive tree-score aggregation followed by sigmoid and learning-rate scaling already incorporated during export serialization. This closes the missing authoritative reference for those two arithmetic decisions; the implementation needs no formula change.

The source is not a JSON schema, an explanation of UUID export tags, an edge-case missing/unknown-category routing specification, or an expected-output fixture for the supplied RBO/Web models. The remaining parity work is concrete: record the producing product/version and compare agreed input profiles and exact routes/outputs with Pega. Do not keep describing exported learning-rate scaling as wholly unknown, and do not upgrade the preview label merely because the general formula is documented.

The current topic's SHAP/model-context/normalized-importance sections inform scope wording, not permission to present structural occurrence counts as importance, an illustrative profile as every Action's score, or the branch walkthrough as SHAP.
