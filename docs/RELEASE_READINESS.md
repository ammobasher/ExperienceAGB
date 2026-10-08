# Deployment and release readiness

## Deploy the static build

Use Node.js 24 and `npm ci`, then `npm run build`. Serve **all of `dist`**, including the generated worker asset, from the same trusted origin over HTTPS. The app has no backend routes or secrets.

For a subpath deployment, build with the chosen base:

```powershell
npm run build -- --base=/ExperienceAGB/
```

The brand link and bundled sample honor Vite's base URL. Verify sample/worker loading and return-to-home under the actual production base before release. Do not upload users' model files to the hosting service.

At minimum, an approved host policy must allow the app's own scripts, styles, worker and static sample fetch (`worker-src 'self'`, `connect-src 'self'`). Development's HMR connection is not a production requirement. Configure security headers appropriate to the real host; a local Vite preview is not a hardened hosting configuration or CSP certification.

## Repository checks

The Actions CI configuration checks install, units/components, TypeScript, production build and serial production-browser E2E/axe/performance cases. It uploads browser evidence even on failures. No cloud workflow was triggered during local implementation; CI is configured, not claimed executed remotely.

Because this checkout's implementation and plan started untracked atop an empty initial commit, GitHub CI cannot exercise them until the owner explicitly commits and pushes the files. This implementation does not commit or push on the user's behalf.

## Gate status

| Gate | State |
|---|---|
| Conservative observed-shape canonical adapter, diagnostics, grammar/type limits and recovery | Implemented; bundled sample and two owner-supplied UUID-v4-tagged production exports pass local structural/browser checks; scoring remains unverified |
| Plain-language explorer, predictor/tree navigation, profile-state and incomplete trace guidance | Implemented; local checks plus actual user review remain distinct |
| No certified final score without independent oracle | Enforced: all calculated propensities remain visibly unverified previews |
| Ensemble formula / export learning-rate scaling | **Documented by Pega:** returned tree scores are summed, then sigmoid applied; export serialization already includes learning-rate scaling. Existing arithmetic agrees; no extra multiplier |
| Main-thread blocking target <=100 ms | Synthetic/high-cardinality regressions and both supplied actual exports pass local exact-threshold checks; no universal hardware/corpus guarantee |
| Automated accessibility, keyboard/focus and viewport coverage | Implemented; not a substitute for manual assistive-technology certification |
| Persistent tests/CI/quick start/export matrix/glossary/privacy docs | Present; hosted CI execution requires owner commit/push |
| Optional contextual AI | Explicitly deferred; no provider/token/privacy assumptions or outbound AI |
| Export/product applicability, exact input/routing and expected-score parity | **Blocked externally**; aggregation/scaling documentation is now supplied, but expected-output fixtures and relevant environment evidence are not |
| Actual performance corpus | **Locally supplied/tested:** 110-tree RBO and 130-tree Web; broader matrix, peak/repeated memory review and approved anonymization/retention/redistribution remain open |
| Manual screen-reader, cross-browser/physical device and target-user usability review | **Open external release review** |
| Dependency/security/privacy review, hosting policies and explicit release approval | **Open external release review** |

Do not call this a certified Pega scorer, production-ready model approval product, complete WCAG implementation, or fully completed original plan. Every supported-version release requires source-attributed oracle fixtures with tolerances and explicit approval. The bundled sample's provenance/redistribution suitability must be confirmed by the owner.

## Optional AI remains a separate decision

Before any AI code: select the endpoint/provider, supported token type/minimum permissions, terms/CORS/org policies, minimal deterministic context, exact destination/payload preview and separate consent for profile values. Keep tokens in memory only, with a forget action; add timeout/cancel/rate/error and prompt-injection tests. No raw model upload by default. These decisions were not invented to close the plan.

## Local acceptance record, 2026-10-07

Final commands: `npm test` **77/77**, `npm run typecheck` **passed**, `npm run build` **passed**, `npm run test:e2e` **13/13**. The production browser checks cover upload/sample, adverse versions/fields/grammar/types/size, missing/invalid/unknown inputs, global blockers, repeated node/field focus, cancellation and network/worker failure with retry, no model/profile storage after reload, 320/390/768/1440 px keyboard/reflow journeys, axe start/explore/trace and both exact main-thread performance gates. Dispatching a native Worker `messageerror` is a synthetic fault injection, not proof of a naturally occurring deserialization fault.

| Independent gate | Findings addressed with regressions |
|---|---|
| Import/scoring judge | Quoted category whitespace, unbounded category argument spreading, nonfinite accumulation |
| Performance/accessibility judge | Unbounded high-cardinality predictor/profile DOM, repeated occurrence focus requests |
| Explorer/trace judge | Whitespace supplied-vs-missing semantics, repeated blocked-field focus, lost resolved prefix before a deeper blocker |
| Production worker/subpath acceptance judge | Native Worker `messageerror` required add/removeEventListener rather than an unsupported property handler |

The final judge independently verified exact 1,031-node reconstruction across 512/512/7 transfer chunks, 511 occurrences across 27 paged requests, exact path/tree/split identity, numeric equality/category whitespace/missing routes, cancellation/supersession/retry and postMessage-throw cleanup. The `/ExperienceAGB/` build served sample/worker/home correctly in installed Edge 154; the default build was restored afterwards. Its actionable finding was reproduced with a failing native-style unit test and real Chrome browser regression, corrected, and included in the final green suites.

TDD evidence is retained outside the repository in session artifacts: initial import group red (20 failing assertions plus the missing recovery component), import-judge red (4), phase-3 red (5 plus missing explanation module), phase-3-judge red (3), final navigation journey red (four viewport focus failures), worker failure red (2), and native-messageerror unit/browser red (1 each). Green logs and JSON/screenshot/trace evidence accompany them. These are local regression evidence, never source-attributed Pega oracle fixtures. An earlier broad acceptance run left browser artifacts but lost its agent report during a runtime interruption; it is not counted as an acceptance verdict.

No scoped preview/debug helper is intentionally left running. All source/tests/docs remain persistent in the original user checkout, uncommitted and unpushed. Hosting, hosted CI and all external gates above remain distinct owner decisions.

## Production-export follow-up, 2026-10-07

The owner supplied two actual production exports as private attachments. Both initially failed only the `"2"` tag gate; a separate in-memory structural probe isolated this from other validation. The adapter now accepts the observed UUID-v4 tag format **only alongside full strict structural validation**, preserves the tag, and does not infer schema/scoring authority from it. Original attachments were not modified or copied into repository/public fixtures.

Tag preservation and honest UI provenance were reproduced red (2 failures) and corrected. A fresh independent code judge found that the private evidence destination guard incorrectly accepted an in-repository directory named `..private-results`. A failing containment test reproduced it; the separator-aware guard now runs both in the test and in Playwright configuration before artifact creation. The invalid configuration was also checked directly and rejected without creating that directory.

Final follow-up: **90/90 unit/component tests**, TypeScript/build passed, **15/15 production browser tests** with the two private paths enabled. See `PERFORMANCE_ACCESSIBILITY.md` for actual workload/heap measurements and `README.md` for opt-in private-run instructions. The two private cases are skipped by default; this is not a hosted private-corpus CI claim.

These files close the absence of a locally testable actual corpus and demonstrate this observed structural variant. They do **not** supply expected Pega routes/raw scores/propensities, establish live-CDH parity, authorize publishing production data, complete manual accessibility/security/privacy review or approve release. All those gates remain open.

## Official documentation follow-up, 2026-10-07

The owner supplied [Pega's The Gradient boosting technique](https://docs.pega.com/bundle/platform/page/platform/decision-management/adaptive-gradient-boosting.html). Its score-calculation section, also checked in the Platform '25 and '24.2 counterparts, establishes additive tree-score aggregation followed by sigmoid and learning-rate scaling already incorporated during export serialization. This closes the missing authoritative reference for those two arithmetic decisions; the implementation needs no formula change.

The source is not a JSON schema, an explanation of UUID export tags, an edge-case missing/unknown-category routing specification, or an expected-output fixture for the supplied RBO/Web models. The remaining parity work is concrete: record the producing product/version and compare agreed input profiles and exact routes/outputs with Pega. Do not keep describing exported learning-rate scaling as wholly unknown, and do not upgrade the preview label merely because the general formula is documented.

The current topic's SHAP/model-context/normalized-importance sections inform scope wording, not permission to present structural occurrence counts as importance, an illustrative profile as every Action's score, or the branch walkthrough as SHAP.
