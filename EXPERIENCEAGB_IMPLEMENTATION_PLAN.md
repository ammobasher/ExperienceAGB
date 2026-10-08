# ExperienceAGB — Rebuild Implementation Plan

**Status:** Feasible local implementation/hardening and owner-supplied production-corpus follow-up complete; local checks passed (90 unit/component and 15 production-browser tests with private corpus enabled, TypeScript and build). Authoritative scoring, approved corpus distribution, broader performance/memory and external release gates remain open. Optional AI explicitly deferred.
**Current checkpoint:** Conservative observed-shape adapter supports the bundled sample and UUID-v4-tagged structures evidenced by two owner-supplied production exports; original tags are preserved, not assumed schema versions. Unknown tag formats/fields, malformed category grammar, contradictory leaf markers and invalid split types remain rejected. All propensities are visibly unverified previews; Pega oracle/live-CDH parity is not claimed. Local worker import/indexing with cancellation, progress, explicit failure and bounded transfers replaces blocking analysis. Tree/predictor/editor collections are bounded and paginated; exact repeated selection reveals/focuses nodes. Explorer includes textual branch labels/outline, subtree navigation, plain-language explanations and metadata diagnostics. Trace includes exact category identity, numeric/missing/unknown states, arithmetic overflow gating, complete and partial branch evidence, global blocked-tree/feature links, per-tree status, and changed-route indicators. Persistent browser/axe/performance tests, opt-in private corpus checks and CI/product documentation are present. Both supplied actual corpora pass local <=100 ms main-thread gates; memory snapshots and their limitations are documented. Authoritative oracle fixtures, corpus rights/broader memory-device review, manual accessibility/usability/security/privacy and release approval remain open; hosted CI has not run.
**Product direction:** A focused, browser-based Pega AGB explorer
**Primary constraint:** No VR or immersive experience is in scope

## 1. Product goal

Build a small, dependable web application that accepts a Pega Adaptive Gradient Boosting (AGB) model export, makes its trees understandable, and lets a user trace an editable profile through the ensemble. The application should serve both decisioning practitioners and business stakeholders: begin with clear language and visible evidence, with technical details available when needed.

The rebuild should start from a simple product contract rather than porting the current application's modes and components. Existing code, tests, and exports may be consulted as reference material, but the new app should adopt only behavior whose semantics and user value are verified.

## 2. Decisions established for this plan

- **Visualization:** 2D-first tree diagrams and ordinary browser UI. No Three.js scene or desktop 3D forest.
- **Audience:** Mixed; plain-language explanations for business users and inspectable evidence for practitioners.
- **Model input:** Pega AGB JSON exports only for the initial release.
- **Profile input:** Generate an illustrative profile from split values, allow users to edit it, and expose missing or unsupported values explicitly. Do not imply the generated profile represents a real customer or population.
- **AI:** On-demand explanations of the current model, tree, node, or trace. The user supplies a GitHub Models API token. AI output is commentary, never the source of model calculations.
- **Hosting and data:** Static browser application; model parsing and deterministic analysis stay client-side. No account, server-side model storage, telemetry, or shared API credential in the MVP.
- **Deliverable:** This document is a plan only; no application code is changed as part of this request.

## 3. Product principles

1. **Correctness before convenience.** Never show a final propensity for an incomplete or unsupported trace.
2. **Explain the evidence.** Every number has a definition, provenance, and clear distinction between model fact, calculation, heuristic, and AI commentary.
3. **Plain language first.** Use ordinary descriptions first; put split syntax, gain, and raw scores behind an inspectable details surface.
4. **One workspace, a few obvious tasks.** Upload/open a model, explore trees and nodes, and trace a profile. Avoid a chooser of multiple “experiences.”
5. **Local by default.** A model is not uploaded. Any AI request is an explicit, user-initiated exception with a preview of what leaves the browser.
6. **No unsupported causal claims.** A split, gain value, or contribution is not by itself evidence that changing a feature causes a business outcome.
7. **Accessible parity.** The tree diagram has keyboard and textual equivalents; color and spatial position are never the only source of meaning.

## 4. Scope

### In scope for the initial product

- Load the bundled sample or a local Pega AGB JSON file.
- Validate the export and report actionable errors and warnings before rendering.
- Show model metadata and a concise ensemble overview.
- Browse an ensemble's trees, search/filter trees, and inspect one 2D tree at a time.
- Explain internal split nodes, both branches, leaf contributions, sample counts, and relevant model facts without presenting an individual node as a propensity.
- Search predictors and navigate to their split occurrences.
- Generate an editable, clearly labeled illustrative profile; edit feature values and trace the profile across trees.
- Show the branch taken, selected leaf, per-tree contribution, running raw ensemble score, and final propensity when the trace is complete and the scoring contract is verified.
- Offer optional, contextual AI explanation from a user-provided GitHub Models API token, subject to explicit disclosure and consent.
- Work at desktop, tablet, and mobile widths, with keyboard operation and reduced-motion support.

### Explicitly out of scope

- VR, WebXR, headsets, controllers, hand tracking, teleportation, locomotion, and immersive HUDs.
- Desktop 3D forests, dioramas, walk mode, cinematic camera movement, and 3D-only interaction.
- Multiple visual skins, animated ambience, particles, environmental metaphors, soundscapes, and gamified story experiences.
- Non-Pega model formats, batch profile scoring, profile comparison, counterfactual search, and multi-user collaboration.
- AI-generated scores, routes, predictor importance, propensity, or automated approval decisions.
- Accounts, server storage of model files, server-side analytics, and a shared API key embedded in the static app.
- Fairness, calibration, production-performance, or model-governance certification based only on tree structure.

## 5. Core user journeys

### A. Open and understand a model

1. The start screen offers **Try sample model** and **Open model file**.
2. The app validates the file and displays progress, then shows a compact overview: model/export identity, update time, tree count, predictor count, training metadata where present, and validation status.
3. The user selects a tree from a searchable, ordered tree list. The app opens that tree as a 2D diagram with a clear initial focus and a short “what this tree does” summary based only on supported facts.
4. Selecting a node opens a concise explanation. Technical split text, counts, and score details are available without overwhelming the default view.

### B. Understand a predictor

1. Search for a predictor by name.
2. See its occurrence count and the trees containing it.
3. Select an occurrence to open the corresponding tree and node, reveal its ancestors, and focus the selected split.
4. Explain predictor-level evidence carefully: occurrence and gain are structural/training statistics, not standalone causal impact or a profile-specific propensity change.

### C. Trace an editable profile

1. Choose **Trace a profile** from the workspace, not from a separate immersive mode.
2. Start with an auto-generated illustrative profile populated from values represented in the model's split definitions. Label it synthetic and explain that it is not sampled from real customer data.
3. Edit values in a searchable form. Represent supplied, missing, invalid, and unsupported states distinctly; do not silently substitute a branch value.
4. Show trace progress by tree. Each step explains the question, the branch taken, the selected leaf contribution, and the running total.
5. At completion, show the verified final propensity and its calculation. Allow stepping backward/forward and jumping to a tree. Editing an input recomputes the trace and makes the changed routes/contributions apparent.
6. If any route is unresolved, identify the feature/tree and withhold the final score rather than manufacturing a result.

### D. Request an AI explanation

1. The user explicitly enables AI and enters their own GitHub Models API token for the current session.
2. Before the request, show the destination/provider and a preview of the exact context to be sent. Exclude the raw model JSON by default. Profile values are sensitive; require explicit confirmation before including them.
3. Send only the minimum computed context relevant to the selected overview, tree, node, or trace.
4. Present the response as AI commentary alongside, not in place of, deterministic facts. Keep the calculation and evidence visible if the request fails or the output is unavailable.
5. Keep the token in memory only; never place it in local storage, URLs, logs, error reports, or persisted app state. Provide a clear action to forget it.

## 6. Explanation and calculation contract

### Model explanations

- **Tree:** A sequence of questions for separating model cases and contributing one selected leaf value to the ensemble for a particular profile.
- **Internal node:** A condition on a predictor. State the parsed condition, branch labels, observed training count if its meaning is confirmed, and gain only with its verified definition.
- **Leaf:** The contribution selected when a profile reaches that leaf. Do not call it a probability or propensity.
- **Gain:** A training-time split statistic. It can help locate influential splits in the model structure, but is not the amount a profile's final propensity changes.
- **Predictor impact:** Distinguish (a) global structural evidence such as split/gain frequency from (b) a specific profile's route and additive leaf contribution. Do not describe either as causal impact.
- **Final propensity:** For Prediction Studio AGB exports, follow the public pdstools scoring implementation: sigmoid of the sum of one selected leaf score per tree. Serialized leaf scores already incorporate the learning rate; a zero raw score yields 0.5. Display only when every route is supported, identify this as the exported-model scorer's result, and do not claim additional live-CDH calibration parity without a Pega scoring oracle.

### Required semantics gates

Before presenting a final propensity, verify against Pega documentation and scoring-oracle examples:

- Supported export identity/version and the meaning of serialized node/leaf scores.
- TRUE/left and FALSE/right routing for every supported operator.
- Numeric boundaries, categorical membership, missing values, blank values, invalid numeric values, and unknown categories.
- Whether any model-level calibration, tree weights, multiple score dimensions, or other transformations apply to the supported export.
- Exact route, selected leaf score, raw ensemble total, and final propensity for representative profiles.

The public pdstools `ADMTreesModel.score()` implementation and its AGB explanation article specify `sigmoid(sum(selected tree scores))`, no extra scoring-time learning-rate multiplier, and 0.5 at a zero raw score. Treat this as the exported-model scoring contract for the adapter; live-CDH calibration parity and export-version fixture coverage remain explicit release checks. Unsupported constructs must produce a visible unsupported/incomplete result.

### Synthetic profile rules

- Generate a deterministic, editable example from thresholds and categories actually present in the loaded model.
- Make synthetic status visible anywhere the profile is shown or explained.
- Do not infer realistic distributions, a typical customer, or population frequencies from split definitions.
- Use explicit missing/unknown states when a feature cannot be populated safely; report when a fully traceable example cannot be generated.
- Allow regeneration and reset without changing model data.

## 7. Proposed product structure

Keep the main workspace to a small number of surfaces:

- **Start/load:** sample launch, file picker, validation report, recoverable errors.
- **Model overview:** key facts and direct entry to tree exploration or profile tracing.
- **Tree explorer:** searchable ensemble list, one 2D tree, focused node explanation, predictor navigation.
- **Trace:** profile editor, tree-by-tree route, cumulative score, final propensity when valid.
- **AI explanation:** contextual action attached to the current selection, not a separate AI “experience” or a competing audit dashboard.

Prefer one persistent workspace with responsive panels over nested cards, mode choosers, and multiple full-screen states. On narrow screens, panels become tabs/drawers without removing capabilities. Use concise labels and disclose detailed technical values on demand.

## 8. Technical architecture

Retain a familiar web stack only where it reduces risk; do not preserve existing component boundaries just because they exist.

1. **Import adapter:** Read the file with size limits, parse JSON, identify supported Pega export variants, and return diagnostics. Keep raw schema handling at the boundary.
2. **Canonical domain model:** Typed representation of model metadata, ordered trees, parsed split conditions, missing-value routing, leaf contributions, and provenance/version. Unknown values stay unknown, not zero.
3. **Analysis services:** Pure functions for tree indexing, predictor occurrences, metrics, profile evaluation, trace steps, and score calculation. Reuse a single split parser across validation, display, and routing.
4. **Explanation view models:** Deterministic templates built from typed facts. Label every displayed value by definition and confidence/provenance.
5. **UI state:** Explicit, small state for loaded model, selected tree/node/predictor, profile, trace cursor, and optional AI request. Avoid redundant derived state and experience-specific state machines.
6. **2D visualization:** Render one selected tree at a time. Prefer accessible SVG/DOM structure with keyboard-reachable nodes, branch labels, zoom/pan controls that do not trap users, collapse/expand, and a synchronized tree outline/list. Benchmark before adopting canvas or another renderer.
7. **AI adapter:** Isolated provider client and request schema. Build a minimal context object from canonical computed facts; do not give AI authority over parsing or score calculations.
8. **Persistence:** None for model/profile/token in the first release unless a later explicit requirement is approved. Any future recents feature must be local, opt-in, and clearable.

Workers are not an automatic starting requirement. Measure import, validation, indexing, and rendering against authentic exports first. Move expensive, pure analysis to a Web Worker if it causes perceptible main-thread stalls; include progress, cancellation, and worker-failure recovery when doing so.

## 9. Implementation phases and exit gates

### Phase 0 — Product and export contract

**Deliverables**

- Version/export inventory for the first supported Pega AGB JSON formats.
- Canonical model and split grammar, with defined unknown/missing states.
- Scoring and routing fixture set from Pega or an authoritative oracle.
- Glossary and approved explanations for model, tree, node, leaf, gain, contribution, and propensity.
- Small/medium/large performance corpus using anonymized authentic exports; baseline at least the current 5 MB/130-tree and 12 MB/110-tree examples.
- Confirmed AI provider endpoint, supported token type and minimum permissions, usage terms, and browser CORS behavior.

**Exit gate:** Supported input versions, score semantics, route behavior, and AI credential model are documented. Any unsupported scoring detail is explicitly gated from the UI.

### Phase 1 — Minimal app foundation and safe import

**Deliverables**

- New repository app shell, build/test commands, error boundary, and sample launch.
- File size/type handling and strict structural validation with path-specific messages.
- Versioned adapter to canonical domain model; deterministic timestamp parsing.
- Parser and validator unit tests for valid, malformed, oversized, unsupported, and adversarial inputs.
- Accessible loading, empty, error, and recovery states.

**Exit gate:** A valid supported model loads into a canonical representation; invalid/unsupported files never reach tree rendering; sample and authentic fixture tests pass.

### Phase 2 — 2D tree explorer and plain-language explanations

**Deliverables**

- Responsive model overview and tree navigation.
- One-tree-at-a-time 2D layout with collapse/expand and legible branch/leaf labels.
- Node selection, breadcrumb/path, text outline, and details panel.
- Predictor search and exact-occurrence navigation across trees.
- Provenance-aware terms and metric definitions; avoid unnecessary dashboards and decorative modes.

**Exit gate:** A practitioner can locate a predictor occurrence and inspect its path; a non-expert can explain in a usability session what a split and leaf represent. Keyboard and narrow-screen journeys remain complete.

### Phase 3 — Editable generated profile and verified trace

**Deliverables**

- Deterministic illustrative-profile generation from model split values, with synthetic labeling and regeneration.
- Searchable editor for profile values and explicit missing/invalid/unknown states.
- Deterministic per-tree routing, selected-leaf contributions, and trace playback/stepping.
- Cumulative raw score and final propensity only for complete, oracle-verified traces.
- Clear incomplete-trace reasons and regression fixtures for every supported operator/state.

**Exit gate:** Golden fixtures match Pega routes, selected leaves, raw totals, and final propensity within documented tolerance. No silent fallback route or mislabeled leaf probability remains.

### Phase 4 — Performance, accessibility, and product hardening

**Deliverables**

- E2E journeys for sample, upload, validation failures, tree/predictor exploration, profile edits, complete/incomplete traces, and narrow layouts.
- Keyboard and screen-reader review of tree navigation, trace playback, forms, dialogs, and announcements; automated accessibility checks in CI.
- Measure parse-to-interactive time, long tasks, diagram layout/render time, and memory on the performance corpus.
- Add a worker only for measured blocking work; add virtualization/collapse or other rendering controls where measurements show need.
- Browser compatibility, dependency/security review, safe error reporting, and production deployment configuration.

**Exit gate:** No critical accessibility/security findings; reference exports are responsive; performance targets are measured and documented on named hardware/browser. A provisional target is no analysis task blocking interaction for over 100 ms; revise only with recorded measurements and UX evidence.

### Phase 5 — Optional contextual AI

**Deliverables**

- Session-only token entry, clear-token control, provider disclosure, request preview, consent, timeout/cancel, and rate/error handling.
- Minimal schemas for model, tree, node, and trace explanations, based on deterministic computed facts.
- Explicit UI distinction between verified facts and AI commentary; no AI-created calculation enters application state.
- Do not send raw model JSON by default. Treat profile values as sensitive and require separate confirmation before sending any.
- Test with missing/invalid tokens, provider errors, oversized responses, prompt injection in model strings, and unavailable network.

**Exit gate:** Security review confirms credential handling and outbound payload behavior; provider terms and token permissions are acceptable. Core import, exploration, and trace workflows remain usable with AI disabled or offline.

### Phase 6 — Release readiness

**Deliverables**

- Quick-start documentation, supported-export matrix, metric glossary, known limitations, and privacy notice.
- Clean-browser smoke test, production build, test reports, accessibility summary, and performance report.
- Product review with both practitioners and non-expert business users.
- Explicit release approval for every supported export version and the optional AI integration.

**Exit gate:** No unresolved critical/high severity correctness, security, or usability defects; all release claims match tested capabilities.

## 10. Test strategy

- **Unit:** JSON adapters, validation, timestamps, split grammar, tree invariants, profile generation, feature state handling, routing, formulas, explanation templates, and AI payload construction.
- **Golden/oracle:** Profile values to exact path/leaf per tree, raw sum, and final propensity, with tolerance and source recorded.
- **Property/fuzz:** Malformed JSON, unusual strings/categories, deep/wide trees, non-finite values, incomplete children, and size/count boundaries.
- **Integration:** Upload through canonical model and UI; predictor search to node selection; profile edit to recomputed trace; AI context preview to provider request.
- **E2E:** Sample first-run, valid and invalid uploads, tree exploration, keyboard journey, trace completion/incompletion, responsive layouts, and AI-disabled operation.
- **Accessibility:** Automated checks plus manual keyboard and screen-reader inspection; test zoom/reflow and reduced motion.
- **Performance:** Import, analysis, selected-tree layout, first useful interaction, trace recomputation, and memory using authentic reference exports.
- **Privacy/security:** Assert no model/profile/token persistence or unintended requests; inspect the exact AI payload and ensure no raw file is sent by default.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Export variants have different score or routing semantics | Version adapters; oracle fixtures; fail closed on unsupported variants. |
| Tree diagrams become unreadable for large/deep trees | One tree at a time, collapse controls, synchronized textual outline, measured layout, progressive detail. |
| Synthetic profile is mistaken for a real or typical customer | Persistent synthetic labeling and explicit explanation; never infer population distributions. |
| Gain or local contribution is described as causal or global impact | Approved glossary/templates; distinguish structural importance from this profile's additive trace. |
| User token is exposed through a shared deployment or browser compromise | Never embed shared secrets; use user-supplied session token only, disclose risks, minimize permissions, avoid persistence/logging, review CSP/XSS surface. |
| Profile values leave the browser through AI | AI disabled until explicit action; preview exact payload; omit profile values by default; separate consent. |
| “Final propensity” is shown for partial or unsupported routes | Typed incomplete trace state; no final score unless every route and formula is supported and verified. |
| Rebuild recreates old complexity under new component names | Enforce scope list and phase gates; require a demonstrated user job before adding features. |

## 12. Deliberate reuse from the current app

The current workspace contains useful evidence, not a requirement to port its UI. Inspect and selectively revalidate:

- Pega AGB sample and authentic export shapes, while confirming redistribution/privacy suitability.
- Timestamp parser, model validator, split parser, tree utilities, and trace tests.
- Documented scoring formula and existing evidence about authentic model sizes.
- User-facing wording lessons: individual nodes are not propensities; a structural audit is not model approval; unknown/missing routes must not silently become a branch.

Do not carry over the VR/WebXR and Three.js code, forest/skin assets, walk/cinematic modes, multi-experience chooser, or AI audit dashboard into the new product.

## 13. Decisions to confirm during Phase 0

These do not block drafting the plan, but must be resolved before implementation reaches the affected phase:

- Exact Pega export versions and any compatibility policy for future schema changes.
- Pega-owned scoring oracle and tolerance for representative numeric, categorical, missing, and boundary cases.
- Whether profile values may be sent to the selected AI provider; default plan is no, unless separately previewed and approved per request.
- Current GitHub Models token requirements, minimum permissions, endpoint availability, usage limits, and organization policy. Do not assume a Copilot subscription credential is an API token.
- Supported browsers/devices and the reference machine for performance targets.
- Whether model downloads, screenshots, or reports are needed after the initial release; default is none.
- Branding, deployment URL, and ownership of the new repository's CI/release process.

## 14. Definition of done for the first usable release

- A user can open a supported Pega AGB JSON or launch the sample and understand validation results.
- A user can browse trees, find predictors, select a node, and understand what its split/leaf value means without confusing it with propensity.
- A user can edit a generated synthetic profile and follow it through every supported tree.
- A complete supported trace reproduces Pega's per-tree routes and final propensity; an incomplete one clearly withholds the final result.
- Core workflows work on keyboard, mobile-width screens, and with AI disabled.
- No VR, WebXR, desktop 3D, or immersive dependency is present.
- Optional AI explanations are on-demand, contextual, clearly labeled, consent-based, and use only the disclosed payload.
- Automated tests, production build, accessibility review, performance report, privacy review, and supported-version documentation pass their release gates.

## 15. Local completion and external gate record (2026-10-06)

The completion implementation does not reinterpret internal regression cases as independent oracle fixtures. See `docs/SUPPORTED_EXPORTS.md` for the narrow observed adapter boundary and `docs/RELEASE_READINESS.md` for the gate matrix. No verified final propensity is exposed while those gates are open.

- Phase 0: documented provisional sample-v2 contract and glossary; external version/oracle/corpus decisions remain blocked.
- Phase 1: canonical validation, strict grammar/type/limit handling, diagnostics, worker failure/cancel/retry and render recovery implemented.
- Phase 2: bounded 2D explorer, labels, plain-language details, outline, navigation, search and selection reveal/focus implemented; target-user review remains open.
- Phase 3: illustrative generation/editing, explicit feature states, additive preview, partial route evidence, global blockers, changed routes and overflow gating implemented; authoritative scoring gate remains blocked.
- Phase 4: persistent production E2E, automated WCAG checks and exact <=100 ms main-thread blocking regressions for both large-node and high-cardinality synthetic corpora implemented. Measurements are not authentic-corpus or universal device certification.
- Phase 5: **explicitly deferred by completion scope**. No outbound AI or credential handling is implemented; provider/token/privacy decisions were not invented.
- Phase 6: documentation and CI configuration implemented; remote CI execution, hosting policies, formal reviews and release approval remain owner/external actions. The local checkout remains uncommitted/unpushed.

Independent judges were used at coherent import, performance/accessibility and explorer/trace gates. Their actionable findings were reproduced with failing tests and fixed before advancing. A final bounded production-worker/subpath judge verified exact reconstruction of 1,031 nodes in 512/512/7 chunks, 511 occurrences across 27 page requests, route fidelity, lifecycle and subpath sample/worker/home. Its native `messageerror` registration finding was reproduced by both EventTarget-based unit and real-browser failing tests, then fixed using add/removeEventListener; final full suites passed. See `docs/RELEASE_READINESS.md` for the acceptance record and remaining gates.

Production-export follow-up: the missing local authentic corpus is now supplied (RBO 12,504,681 bytes / 110 trees; Web 5,428,277 bytes / 130 trees). Original files passed strict structural import and actual production browser import/edit/paged selection/mobile/lifecycle checks after evidence-backed UUID-tag adaptation. Private aggregate heap/timing reports remain outside the repository. A fresh judge's artifact containment finding was reproduced red and fixed before the 90-unit/15-browser green run. This narrows Phase 0/4 corpus gates but does not certify expected scores, distribution rights, peak/repeated memory behavior, other devices or release.

Official source follow-up (2026-10-07): [Pega's The Gradient boosting technique](https://docs.pega.com/bundle/platform/page/platform/decision-management/adaptive-gradient-boosting.html), including the '25 and '24.2 topics, confirms summing returned tree scores and applying sigmoid, with learning-rate scaling already applied during export serialization. The implementation's aggregation/no-extra-multiplier decisions therefore have authoritative documentation. The remaining scoring gate concerns the actual export/product applicability, node/input interpretation, edge-case routes and expected Pega outputs, not an unresolved general ensemble formula. SHAP/normalized importance and Action/Treatment context in the current topic remain distinct from this app's structural walkthrough and synthetic profile.