# ExperienceAGB

A local-first, 2D explorer for the **observed bundled sample-v2 and owner-supplied UUID-v4-tagged Pega JSON structures**. Open a file or try the bundled demonstration, find a predictor, inspect its questions and leaves, and trace an editable illustrative profile.

**This is an unverified export preview, not a production scorer or model certification.** The owner approved release as a **local-only exploratory tool** and publication of the **bundled demonstration sample only**. Two owner-supplied production exports have been tested privately; they are not published and their redistribution is not authorized. Independent Pega parity is needed for certification, not for using this preview. Manual assistive-technology/device/usability checks remain distinct limitations.

## Run locally

Use Node.js 24 LTS and npm:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

Open the local URL printed by Vite. Production preview:

```powershell
npm run build
npm run start:local
```

The application requires JavaScript and local Web Workers. Import failure is surfaced rather than falling back to blocking main-thread parsing.

## Core tasks

1. **Open** a `.json` file up to 25 MiB, or **Try the bundled sample**. Correct all structural errors in the validation report. Only observed tag formats and structure are accepted; unknown fields are deliberately rejected rather than assumed compatible.
2. **Explore trees**. Search trees by number or predictor, or search predictor occurrences. On narrow screens, open **Find a tree or predictor**. Occurrence selection reveals and focuses the exact split.
3. Inspect a node's plain-language question, both branch labels, and technical provenance. The selected tree opens **fully expanded**, without an automatic depth limit or 127-node cutoff. Scroll or zoom to explore it; **Fit tree** fits the complete scope, even below 15% zoom. **Focus this subtree** explicitly narrows the scope; **Root** restores the complete tree. Collapse is optional: select a split and choose **Collapse descendants**, then **Expand descendants** to restore its entire subtree. Collapsed splits marked **+ more** are not leaves. The map and synchronized **Text outline** report shown versus whole-tree totals. Large trees draw progressively with visible progress; no nodes are discarded. Very large diagrams can take longer and use more browser memory.
4. **Trace a profile**. Open the editor, search or page through features, edit exact values, reset, or generate another illustration. Inputs are synthetic, not a customer sample. Unknown categories and unsupported/mixed feature types block a preview.
5. Read branch decisions, leaf contributions, running raw scores, and the paginated ensemble status. Follow incomplete-route links to the affected tree or field. Edits identify changed routes/contributions, including route changes with equal leaf scores.
6. Choose **Enter diagram fullscreen** for more room. The same complete drawing, selection, zoom and manual scope remain in place. **Exit diagram fullscreen** or **Escape** returns to the workspace. Node details and the text outline remain available; unsupported/denied fullscreen is reported explicitly.
7. Open **Technical terms and metric scopes**, or a metric's **?** disclosure. **Nodes across all trees** is the ensemble-wide total; **Total nodes in selected tree** is one tree; diagram counts refer to the currently drawn tree/subtree. A collapsed split is not a leaf.
8. Choose **Model insights** for local structural analytics. **Overview** separates exported/computed metrics and unavailable evidence; **Predictors** ranks stored gain, split/root frequency and cumulative gain share; **Tree diagnostics** links export-order points to the full tree; **History & context** shows threshold distributions, membership/missing-check inventory, depth-by-namespace heatmap and all-leaf score/counter density; **Review findings** gives nonjudgmental candidates and next checks. Tables are paginated, charts scroll on narrow screens, and predictor/bin links open exact existing evidence.

### Local structural audit and download

Insights implement selected, vetted v6.4 structural analyses in the existing TypeScript worker. The attached Python engine/HTML and 4.8 MB Plotly bundle are not runtime dependencies. Missing AUC or leaf gains do not suppress independent structure/gain analysis. Full-model gain shares require complete nonnegative internal gains and a positive total; missing values remain unavailable. Tiny positive gains retain their signal. Literal namespaces, provisional roles and unverified upstream provenance are separate.

Numeric histograms include every numeric split in 12 equal-width bins (one for a constant threshold or when floating-point precision prevents distinct bin boundaries). Membership cardinality counts distinct values actually stored in conditions, not population values. The leaf density includes every leaf in bounded signed-score/log-counter bins; a linked example is not a representative customer. Diagnostic depth counts edges with root zero, while explorer levels count root one. Tree order is not a verified chronology or memory window.

**Keep a reproducible local audit** requires explicit sensitive-download approval. Prepare script-free offline HTML or a JSON evidence bundle, then save the prepared file. Both retain exact numbers, source-byte SHA-256, algorithm/evidence/contract versions, metric methods/operands/availability, figure definitions/data and limitations. JSON also contains a formula-escaped predictor CSV and chart SVG. Names, thresholds and counters are sensitive; downloads persist outside this app until you delete them. No raw forest, AI output, CDN or upload is involved.

Imports now reject duplicate JSON keys, including escape-equivalent nested keys, instead of silently keeping the last value.

### Compare exports over time

Choose **Compare model snapshots** on the start page or **Model evolution** in an open workspace. Confirm that the exports belong to the same model, then **Add snapshot files** (multiple `.json` files, each within the existing 25 MiB limit). The schema has no reliable model identity: filenames, export tags and shared predictors cannot prove same-model membership.

Files are validated sequentially in a separate local worker. Only summary metrics, exact predictor names, binned thresholds, observed-category cardinalities/set hashes, namespace/gain summaries, export tags/times and local duplicate-detection hashes are retained for the series; additional forests are not transferred into the workspace. Exact byte duplicates are skipped with a report. If an unchanged model was genuinely observed at another time, **Keep as separate snapshot** explicitly retains the duplicate without a date; supply its actual UTC observation time before charting it. Invalid files are reported without discarding successful imports; cancellation keeps completed snapshots and stops unfinished/remaining files. This comparison never sends an AI request or replaces the open model. The open export is not automatically included; select its file if desired.

Charts use actual elapsed UTC spacing. Validated `factoryUpdateTime` supplies the initial time; missing times require an explicit **Apply UTC time** override. Manual entries mean UTC regardless of your device's timezone, with provenance and an option to restore the export time. No date is guessed from a filename or file modification. Undated snapshots stay in the tables but not trends; duplicate times pause chronology until corrected or removed.

Metric selectors cover tree/node/leaf/predictor counts, deepest path, exported AUC/success rate and positive/negative/total training counts. Missing values break lines rather than becoming zeros. Proportion axes remain fixed at 0-1; success rates display as percentages and changes as percentage points. Paginated tables retain exact counts and parsed evaluation values alongside rounded displays. Earliest-to-latest insights show structural/metadata changes and exact-name predictor additions/removals, not causal explanations or certified performance improvements. Training/evaluation populations may differ. Shared-profile scoring comparisons and drift detection are not included.

Evolution also charts stored internal gain/largest predictor share, stumps and explicit missing checks. Shared-predictor tables compare gain shares and tied ranks; namespace tables compare gain composition. Numeric comparisons retain exact before/after threshold histograms. Membership comparisons use SHA-256 of sorted distinct observed sets, detecting replacements even when cardinality is unchanged; original category values are not retained in the series. Missing required gains do not become zero shares. Tree identity, pruning/retirement and chronological tree-age inference remain disabled without independent continuity evidence.

Models, profiles and comparison summaries are not persisted by the browser app. Switching workspace views preserves them; reload, **Open another**, closing the standalone comparison or leaving the page clears the corresponding workspace. **Remove** and **Clear comparison** change only in-memory summaries, never files. Optional Copilot SDK state is isolated and deleted per request, not guaranteed securely erased. Explicitly approved AI context is subject to the selected provider's separate retention policies. See [Privacy](docs/PRIVACY.md).

**Optional AI explanation** is disabled by default. **GitHub Copilot SDK/local CLI is the default provider** (`auto`); **Anthropic remains an explicit alternative** (`claude-haiku-5-5`). Open `http://127.0.0.1:5183/` after `npm run start:local`. Configure an explicitly approved, entitled `COPILOT_GITHUB_TOKEN` only in the server environment; strict per-request isolation deliberately does not inherit chat/stored-login/ambient `GH_TOKEN` credentials. For Anthropic set server-only `ANTHROPIC_API_KEY` and select it in the panel. There is no silent fallback. Without credentials, analysis works and AI gives instructions. See [AI setup, privacy and limits](docs/AI.md). Automated provider tests are mocked; owner-run attempts do not establish successful end-to-end live acceptance.

The single **AI explanation of this model** panel appears at the bottom of the
workspace, below the tree explorer/profile trace/evolution view. There is no second
selected-context commentary panel.
It uses a **bounded v6.4 application adaptation and evidence computed locally
across every accepted tree and node**, not the raw JSON or just a selected tree.
Enable it, review the computed evidence, instructions and downloadable
exact provider payload, acknowledge provider terms, approve evidence sharing,
then choose **Generate approved model explanation**. Import does not trigger
an LLM call. Names, splits, categories, thresholds, export identifiers, timestamps,
filename and profile are withheld. Monitoring counts/rates and structural/gain
aggregates can still be sensitive. Evidence is limited to 16 KiB and the complete
request, including the v6.4 adaptation, to 128 KiB regardless of import size.
Provider context limits and deadlines still apply; there is no automatic retry,
truncation, chunked inference or fallback.
The reply remains with that model while you browse trees or edit a profile;
closing/replacing the model clears it. It is plain-text, unverified explanation,
not the full v6.4 Python/HTML audit or certified scoring. The LLM may restate
supplied evidence numbers with field citations; unsupported audit outputs remain
PENDING EXECUTION. The source prompt's full execution gates are not claimed.
Consultant and technical-evidence views share the same response without another
call. The local predictor alias key resolves redacted slots on-device only.

The model-wide summary includes counts, monitoring,
gain/structure diagnostics, namespace shares and up to eight redacted top
predictor slots; it is not the raw file or a complete Python/HTML structural
audit. Missing evidence stays explicitly unavailable. The former selected-context
contract remains internally tested but is not exposed in the workspace. When a
backend contract changes, restart the credential-configured bridge and reopen
the model; stale bridges are detected. **The v6.4 update changes the backend
contract, so restart an already-running local AI bridge and reopen the model.**
The UI does not migrate old approvals or weaken server validation.

## Checks

```powershell
npm test
npm run typecheck
npm run build
npm run test:server
npx playwright install chromium
npm run test:e2e
```

If Chrome is already installed, the local Windows review can use it without downloading a browser:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Playwright builds and starts a scoped production preview on `127.0.0.1:5180` and stops it after the run. If a different process owns that port, select a verified free explicit `E2E_PORT` (1024-65535); do not kill user processes or enable server reuse to conceal ownership. Do not run concurrent builds/E2E in this shared checkout, even on different ports. Failed tests retain screenshots/traces; benchmark and accessibility evidence is written under `test-results` (gitignored). `E2E_OUTPUT_DIR` can place evidence elsewhere. Unit/component tests run in Vitest/jsdom; browser tests are separate and use the actual sample, worker and production bundle.

CI performs the same unit/build/browser checks and uploads evidence. A passing CI run is not independent Pega-oracle verification.

The integrated subpath deployment smoke and separate static-only host are also available:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npx playwright test --config=e2e\hosting.config.ts
npm run build
node scripts\preview-host.mjs
```

The smoke builds `/ExperienceAGB/` and checks the integrated local host on 5182; restore the default build afterward as shown. The separate reference static host binds only to loopback on port 5182, rejects writes and serves only built assets with explicit security headers; it cannot provide AI. Neither host is a TLS server or approval of a public hosting service.

### Private production-corpus checks

The repository does not contain production model payloads. The two opt-in corpus tests are skipped unless approved local paths are supplied. Keep their evidence outside the checkout; configuration rejects an in-repository destination before creating test artifacts.

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:AGB_PRIVATE_RBO_EXPORT = 'C:\approved-private-corpus\rbo.json'
$env:AGB_PRIVATE_WEB_EXPORT = 'C:\approved-private-corpus\web.json'
$env:E2E_OUTPUT_DIR = 'C:\approved-private-evidence'
npm run test:e2e -- private-corpus
```

Use these placeholders only with files and destinations you are authorized to access. Private tests disable screenshots/traces and emit aggregate counts/timings/heap snapshots, not model/profile contents. Failure diagnostics can still reveal local UI details, so treat the entire evidence directory as private. Do not add production exports to `public`, repository fixtures or ordinary CI artifacts without separate approval.

## Documentation

- [Supported export boundary and preview semantics](docs/SUPPORTED_EXPORTS.md)
- [Metric glossary](docs/GLOSSARY.md)
- [Privacy and local data lifecycle](docs/PRIVACY.md)
- [Performance and accessibility evidence](docs/PERFORMANCE_ACCESSIBILITY.md)
- [Deployment and remaining release gates](docs/RELEASE_READINESS.md)

No app account, VR, 3D renderer, raw model upload, browser credential or AI-generated calculation is part of this preview. The only backend is the approved loopback commentary bridge. Optional SDK tools/discovery/shared stores/content telemetry are disabled; provider service policies still apply. Only approved minimized application context can leave the device. Core analysis remains local with AI disabled or unavailable.
