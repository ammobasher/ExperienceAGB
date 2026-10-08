# ExperienceAGB

A static, local-first, 2D explorer for the **observed bundled sample-v2 and owner-supplied UUID-v4-tagged Pega JSON structures**. Open a file or try the bundled demonstration, find a predictor, inspect its questions and leaves, and trace an editable illustrative profile.

**This is an unverified export preview, not a production scorer or model certification.** Two owner-supplied production exports have been tested locally; this does not establish score parity or redistribution rights. Pega oracle fixtures, live-CDH parity, approved corpus distribution, manual assistive-technology review, and release approval remain external gates. Optional AI is explicitly deferred; there is no AI provider, token entry, or outbound AI request.

## Run locally

Use Node.js 24 LTS and npm:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Production preview:

```powershell
npm run build
npm run preview
```

The application requires JavaScript and local Web Workers. Import failure is surfaced rather than falling back to blocking main-thread parsing.

## Core tasks

1. **Open** a `.json` file up to 25 MiB, or **Try the bundled sample**. Correct all structural errors in the validation report. Only observed tag formats and structure are accepted; unknown fields are deliberately rejected rather than assumed compatible.
2. **Explore trees**. Search trees by number or predictor, or search predictor occurrences. On narrow screens, open **Find a tree or predictor**. Occurrence selection reveals and focuses the exact split.
3. Inspect a node's plain-language question, both branch labels, and technical provenance. Use the synchronized **Text outline**, collapse/expand, **Focus this subtree**, **Root**, **Fit tree**, and **Reveal selected node**. Initial rendering is bounded; the entire model is not drawn at once.
4. **Trace a profile**. Open the editor, search or page through features, edit exact values, reset, or generate another illustration. Inputs are synthetic, not a customer sample. Unknown categories and unsupported/mixed feature types block a preview.
5. Read branch decisions, leaf contributions, running raw scores, and the paginated ensemble status. Follow incomplete-route links to the affected tree or field. Edits identify changed routes/contributions, including route changes with equal leaf scores.

Models and profiles are not persisted; reload or **Open another** clears the workspace. See [Privacy](docs/PRIVACY.md).

## Checks

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

If Chrome is already installed, the local Windows review can use it without downloading a browser:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Playwright builds and starts a scoped production preview on `127.0.0.1:5180` and stops it after the run. Do not run two E2E invocations on that port concurrently. Failed tests retain screenshots/traces; benchmark and accessibility evidence is written under `test-results` (gitignored). `E2E_OUTPUT_DIR` can place evidence elsewhere. Unit/component tests run in Vitest/jsdom; browser tests are separate and use the actual sample, worker and production bundle.

CI performs the same unit/build/browser checks and uploads evidence. A passing CI run is not independent Pega-oracle verification.

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

No backend, account, VR, 3D renderer, telemetry, model uploads, shared API credential, or AI-generated calculation is part of this product.
