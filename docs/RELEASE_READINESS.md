# Deployment and release readiness

## Current release scope (2026-10-09)

The owner approved release as a **local-only exploratory tool with unverified scoring previews**, publication of the **existing bundled demonstration sample only**, and commit/push of the completed changes. This is not permission to publish customer exports, profiles, actual identities, private research or test evidence, approve provider terms, or declare scoring/accessibility/security certification. Private-core access and independent Java parity are not implementation blockers for this accepted preview. The earlier baseline was published as `50efd345ca8e77f465c9edac2e64e7b7016a19b0`; [hosted CI passed for that baseline](https://github.com/ammobasher/ExperienceAGB/actions/runs/37745532116). That old hosted run does not cover this release's changes; publication and subsequent CI are recorded in Git/GitHub.

GitHub Copilot is the requested future default for commentary. Official SDK use requires a local authenticated CLI runtime; adding a loopback Node bridge awaits separate architecture authorization. Live AI remains disabled, with no internal endpoint or browser API-key assumption. This does not hold the approved local exploratory release.

Historical results below are dated records. In particular, the publication rerun found a synthetic **156 ms** main-thread task against the unchanged **100 ms** target and an isolated 5-second workspace timeout. Earlier green runs do not erase those results. The new acceptance record must document the root cause, changed behavior and fresh measurements rather than weakening the target.

## Run the approved local-only static build

Use Node.js 24 and `npm ci`, then `npm run build` and `node scripts\preview-host.mjs`. The reference host binds only to `127.0.0.1:5182` and serves **all of `dist`**, including the generated worker asset. Trusted-device loopback HTTP is the approved scope; do not bind to `0.0.0.0`, expose a LAN/public tunnel or upload private exports. The app has no backend inference routes or secrets.

For a subpath deployment, build with the chosen base:

```powershell
npm run build -- --base=/ExperienceAGB/
```

The brand link and bundled sample honor Vite's base URL. Verify sample/worker loading and return-to-home under the actual production base before release. Do not upload users' model files to the hosting service.

At minimum, an approved host policy must allow the app's own scripts, styles, worker and static sample fetch (`worker-src 'self'`, `connect-src 'self'`). The retired GitHub Models service does not justify any external egress exception. A future separately approved provider would require a newly reviewed exact destination. Development's HMR connection is not a production requirement.

`scripts/preview-host.mjs` is a loopback-only reference host with CSP, `nosniff`, no-referrer, denied framing, disabled camera/microphone/geolocation, write-method rejection and path containment. Its CSP deliberately permits inline **styles** for the existing React/SVG layout, not inline scripts or eval. It has no upload endpoint or SPA fallback that can disguise missing assets. `node --test scripts\preview-host.test.mjs` checks these boundaries. `npx playwright test --config=e2e\hosting.config.ts` builds and checks the actual `/ExperienceAGB/` sample/worker/home under these headers. Restore `npm run build` afterward for the normal base.

This is a local exploratory release, not a public production deployment. HTTPS/HSTS and a public-host policy are not required claims for approved loopback HTTP. Any future remote hosting requires separate authorization and review of TLS, headers, privacy, MIME/asset routing and permitted AI egress. Do not add HSTS to loopback and mistake it for an HTTPS check.

## Repository checks

The Actions CI configuration checks install, units/components, TypeScript, reference-host boundaries, production build and serial production-browser E2E/axe/performance plus subpath-hosting cases. It uploads browser evidence even on failures. Hosted CI passed for the published baseline; changed-source local acceptance and a later publication's hosted CI are distinct.

### Final local acceptance, 2026-10-09

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
| Optional contextual AI | Local preview/mock scaffolding only. GitHub Copilot requested as future default; official SDK/CLI loopback bridge awaits architecture authorization. No live inference, credential entry or internal endpoint |
| Export/product applicability, exact input/routing and expected-score parity | **Open certification gate**, not a preview implementation blocker; documented formula and companion evidence supplied, independent expected-output fixtures are not |
| Actual performance corpus | **Locally supplied/tested:** 110-tree RBO and 130-tree Web, each five same-renderer import/edit/close cycles; all workers terminate, warm growth 0.137/0.134 MiB within provisional bounds. Broader corpus, peak/RSS/repeated worker heap/device matrix and redistribution remain open |
| Manual screen-reader, physical device and target-user usability review | **Open external release review**; installed-browser automated journeys are not physical-device or screen-reader certification |
| Dependency/security/privacy review, hosting and release approval | Local audit/scoped review and loopback hosting passed. Owner approved exploratory release with limitations, bundled-sample-only publication and commit/push; no formal certification or remote deployment approval |

Do not call this a certified Pega scorer, production-ready model approval product, complete WCAG implementation, or fully certified original plan. Certification requires source-attributed oracle fixtures with tolerances and explicit approval. The owner approved publication of the bundled sample only; this is not a general permission to redistribute supplied production exports or future samples.

## Optional AI approval remains a separate gate

The original GitHub Models choice is retired, per its [public notice](https://docs.github.com/en/github-models). The owner now requests GitHub Copilot, whose [official SDK](https://github.com/github/copilot-sdk) uses an authenticated local CLI runtime over JSON-RPC. A browser-to-loopback Node bridge is a material static-architecture change awaiting authorization; no assumed Copilot API-key endpoint or reverse-engineered API is used. Local exact-context preview and historical-format mock defenses remain scaffolding. Production sends **nothing**. Any authorized future bridge requires current official authentication, tools/file-access restrictions, consent/transport boundaries, terms and security review. See `AI.md`.

## Local acceptance record, 2026-10-07

### Manual approval checklist still required

| Owner / review | Concrete acceptance evidence |
|---|---|
| Practitioner and non-expert users | Open an approved export, locate a predictor, explain a split versus a leaf, edit an illustration and recognize incomplete/unverified scoring without coaching. Record observed problems, not assumed satisfaction. |
| Assistive-technology reviewer | Actual NVDA/JAWS/VoiceOver keyboard journeys through upload, selected-node outline, trace states and AI consent/error announcements. Axe and programmatic focus checks do not establish this. |
| Device/browser reviewer | Actual 200% and 400% browser zoom, text enlargement, physical touch targets and at least one small physical device. CDP half-width/high-DPI emulation is reflow evidence, **not actual browser zoom**. Firefox/WebKit acceptance requires their real engines, not treating Edge and Chrome as independent engines. |
| Data/model owner | Bundled-sample-only publication approved. Private exports/evidence remain excluded; producing build and independent routes/scores are needed only for certification beyond this preview. |
| AI user / organization | Authorize or defer the official Copilot SDK/CLI loopback bridge, authentication, terms and minimized data sharing. Mocked tests do not establish live entitlement, availability or policy approval. |
| Deployment owner | Local-only loopback hosting approved and checked. Any future public/LAN hosting, TLS/HSTS or external egress needs new approval and validation. |
| Release owner | Exploratory wording, unverified scoring, local-only hosting, bundled-sample-only publication and commit/push approved. This does not certify remaining manual/device/security checks or authorize live AI. |

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
