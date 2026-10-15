# Privacy and local data lifecycle

- This is a local-first browser application with an optional loopback commentary bridge. GitHub Copilot SDK/local CLI is the default; Anthropic is an explicitly selected alternative, never a fallback. Local files are read and parsed by a local Web Worker; deterministic analysis stays in that browser.
- The approved release is **local-only hosting** on loopback. The owner authorized publishing only the bundled demonstration sample, not private exports, profiles, identities or test evidence. Repository publication is not permission to deploy a public model-upload service.
- Model/profile data stays in page/worker memory until explicitly shared. There is no localStorage/sessionStorage/IndexedDB persistence, recents list or app account. Approved minimized context or computed whole-model evidence passes through the loopback server to the selected provider. Raw model JSON is no longer an accepted provider input. The app does not log payloads. The SDK can create isolated ephemeral session state outside the project; sessions/runtime are closed and their directory removed per request. SDK shared stores/content telemetry are disabled. Crash remnants, OS traces/backups and provider retention are not guaranteed erased.
- **Model evolution stays local.** Multiple user-selected files are validated sequentially in dedicated temporary workers, separate from the open model's occurrence worker. Comparison summaries retain counts, exact predictor names, available training/evaluation metrics, tags, filenames, timestamps/manual date provenance and local SHA-256 hashes for exact-byte duplicate detection. These can be sensitive; they are not added to AI evidence or uploaded. Additional forests are not transferred to the comparison UI, and each summary worker terminates after success, rejection, failure or cancellation. Unfinished/remaining files are not added on cancellation; completed summaries remain until removed/cleared. Switching workspace views preserves summaries; closing the model/standalone comparison, refresh or navigation clears them. Files are never modified. This is memory lifecycle management, not secure erasure or a guarantee of unlimited series size.
- Loading the bundled sample fetches a static file from the application's own origin. Application assets and the worker are also same-origin requests. In development, Vite uses its ordinary local development connection.
- **Open another**, import cancellation, recovery, reload, or leaving the page disposes of the active worker and/or workspace. This is an application lifecycle statement, not a secure memory-erasure guarantee; browser/OS memory and user-controlled extensions are outside the app's control.
- Optional **AI is a cloud exception**, disabled by default. One whole-model explanation panel appears at the bottom of the workspace; the duplicate selected-context panel is no longer exposed. Every request requires selected destination/exact application-message approval; Copilot SDK/runtime service/safety/routing additions are disclosed, not falsely presented as exact wire JSON. Model explanation excludes raw exports, names, categories, split strings, thresholds, export identifiers, timestamps and local filenames; it requires separate one-request evidence-sharing consent and never includes a profile. The legacy internal selected-context contract separately approves numeric profile values and remains tested, but is not part of the current workspace UI. Monitoring counts/rates and structural/gain aggregates remain potentially sensitive: redaction is not anonymity. Provider/model/evidence changes invalidate consent and abort pending work. See [AI](AI.md).
- The import worker computes whole-model evidence over every accepted tree/node. The model-level explanation uses it with a bounded v6.4 instruction adaptation. The earlier original v6.3 text remains archived but is not sent. Evidence is capped at 16 KiB, with a 128 KiB complete-request cap including the adaptation. Server allowlists reject raw JSON, arbitrary strings and old full-file approvals. Requests do not send other attachments or read local files through agent tools. An optional exact-payload download saves a sensitive copy to a user-chosen local destination; it is not erased by closing the workspace.
- `COPILOT_GITHUB_TOKEN` and optional `ANTHROPIC_API_KEY` belong only in the local server environment. No browser key input or credential return/log exists. Copilot receives only its explicit credential, not ambient GH_TOKEN/GITHUB_TOKEN/chat credentials, stored-login fallback or the Anthropic key. Its runtime has isolated config/home/workspace, no tools/MCP/skills/file access/ambient instructions/session export. Disable/forget clears browser consent, not server credentials. Stop the bridge, remove environment variables and revoke provider credentials to revoke local access.
- Anthropic's commercial notice states normal API input/output deletion within 30 days, with agreement, policy-enforcement and legal exceptions and possible longer retention. Review the linked current notice and your account terms; zero retention, residency, training exclusion and organizational approval are not guaranteed. Mocked tests do not establish live entitlement or legal approval.
- Copilot retention is governed by the current [GitHub Copilot privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-copilot-privacy-statement) and account/organization agreement, not local SDK deletion. No internal endpoint, GitHub Models fallback, arbitrary proxy URL, agent tools, application automatic retry or fallback is used. Runtime internal routing/transport is not claimed to map one-to-one to provider billing. Cancellation stops owned work but cannot recall transferred payloads or guarantee no charge.
- Render-failure logging uses a generic message without model/profile content. User-visible diagnostics include local JSON paths and model facts; do not paste sensitive exports into public issues.
- Optional AI bridge terminal diagnostics contain only a random request ID, provider enum, fixed phase/result labels, elapsed time and optional fixed SDK or state-removal failure category. No keys/CSRF/session IDs, paths, prompts, model/profile context, raw provider errors or generated commentary are logged. This operational metadata can remain in terminal scrollback or OS capture; the app does not create a diagnostic log file. Failed owned-runtime/state cleanup blocks further Copilot runtime creation until the bridge is restarted after resolving the state; consent/send is also disabled, with no automatic fallback.
- Standard browser extensions, devtools, screenshots, host access logs, and third-party hosting infrastructure can have their own data policies. Use a trusted browser/device and approved hosting.

Runtime tests check that opening/tracing a model does not create persisted app state. A scoped loopback-only review observed no model upload. These checks are not a full security/privacy certification; a formal review remains a release gate.

## Local structural analytics and explicit downloads

Model insights retain local predictor names, exact namespace prefixes, provisional
roles, thresholds/histograms, observed-category cardinalities and cryptographic
set digests, tree summaries and bounded all-leaf density data. They are not added
to AI payloads. The worker hashes exact source bytes with SHA-256; this is not a
model identity or anonymization guarantee. Raw observed membership strings are
used transiently to compute cardinalities/digests, not retained in evolution
summaries. Additional snapshot forests remain worker-local and are released
when their dedicated worker terminates.

The **sensitive local audit download** is a separate explicit action from cloud
approval. Preparing creates a worker-generated in-memory Blob and a revocable
download link; saving writes outside app memory. HTML/JSON include names,
thresholds, counters, hashes, figure data and availability/limitations; JSON also
contains predictor CSV and an SVG. No raw forest or AI narrative is embedded.
HTML is script-free, escapes model strings, has a restrictive offline CSP and
needs no CDN. CSV text cells beginning with formula-like characters are prefixed
with an apostrophe. These safeguards are not a formal security certification.

View changes/close release prepared URLs; saved copies, browser download history,
OS caches and backups are not erased. Users must manage them under their data
policy. Local predictor alias resolution stays on-device and never modifies the
approved provider payload. v6.4 contract changes require a bridge restart and
fresh evidence/terms/exact-body approvals.
