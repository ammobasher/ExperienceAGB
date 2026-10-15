# Optional whole-model evidence explanation and contextual commentary

## Whole-model evidence explanation

The owner originally requested an LLM explanation using the original
`agb-audit-prompt-v6.3.md` and entire raw export. After repeated generic SDK
errors with a user-reported 6 MB file, the owner chose **local whole-model
analysis with bounded computed evidence sent to the LLM instead of raw JSON**.
There is one **AI explanation of this model** panel at the bottom of the
workspace, after the tree explorer/profile trace. The duplicate selected-context
panel has been removed from the workspace. The whole-model result stays with that
model while browsing trees or changing the illustrative profile, and is cleared
when the model is closed/replaced or the provider/configuration is changed.

Import does not call an LLM. Enable the panel, review the v6.4 adapted instructions
and on-screen evidence/downloadable exact provider payload, acknowledge provider
terms, approve computed-evidence sharing, then separately approve the exact
request before choosing **Generate approved model explanation**. The payload
contains a bounded v6.4 application adaptation and the import worker's
bounded computed evidence. It never contains the original JSON, predictor names,
categories, split strings, thresholds, export identifiers, timestamps, local
filename or illustrative profile. Counts/rates and structural/gain aggregates
may still be sensitive: redaction is not anonymity. Do not approve evidence you
cannot share. Downloading the exact payload deliberately saves a sensitive
local copy; closing the model does not delete user downloads.

The import bound remains 25 MiB. Every accepted tree/node contributes to the
existing local import-worker evidence pass, including nonselected/tail trees.
The evidence dictionary is limited to **16 KiB** and the complete loopback
request to **128 KiB**, independent of source-file size. The exact-key server
allowlist validates evidence bounds and consistency and reconstructs the provider
payload independently; it cannot reparse the original file because it never
receives it. Old raw-file envelopes/approvals are rejected, not silently adapted.
`POST /api/ai/model-explanation` accepts only
`{ provider, payload, approved: true, evidenceApproved: true }`; the UI consumes
both one-request approvals on every send. The old `fullModelApproved` envelope
cannot authorize this different data-sharing contract.
No second parse of a large raw file or raw-request preparation worker is needed.
Only the small validated evidence/request is serialized in the UI.
Application instructions remain paged in 4,096-character blocks; the exact download
includes all instructions/evidence. Local coverage, source bytes, evidence bytes
and complete-request bytes are shown before consent. Missing/invalid evidence
visibly disables sending rather than falling back to raw-file/selected-only data.
Provider context/token limits and request deadlines still apply; byte bounds are
not a token-fit guarantee. Incomplete/truncated responses fail explicitly, without
silently omitting evidence, switching providers or retrying automatically.

The earlier **original v6.3 prompt remains archived verbatim** in
`src/ai/auditPromptV6_3.ts`; it is no longer sent. The current instructions adapt
the reviewed v6.4 evidence discipline rather than shipping its unimplemented
full-audit deliverables. No LLM code execution, file access,
tools, charts or HTML execution are enabled. The bounded local evidence pass
does not establish either full-audit execution regime. The LLM may repeat only
supplied numbers with exact evidence-field citations; no new arithmetic,
invented predictor names, thresholds, rankings, manifest or parse-verification
claims. Unsupported audit outputs remain **PENDING EXECUTION**. This panel does
not claim an executed Sections 0-13 audit, Python/HTML report or scoring certification.
Replies are rendered as plain text with a 32,000-character / 128,000-byte cap.
The Anthropic full-model alternative requests up to 8,192 output tokens; its
short contextual mode remains 500 tokens / 8,000 characters.

The current commentary contract is **`agb-v6.4-local-evidence-v5`**, with
`whole-model-v2` evidence. Restart an already-running credential-configured
bridge and reopen the model. Old versions/approvals fail visibly; they are not
silently migrated. Whole-model schema validation counts missing checks
separately and validates numeric-looking/singleton membership counts against
their denominator. Missing internal gain disables dependent gain shares, not
independent structure observations. Namespace buckets follow known literal
prefixes/context names; a Score keyword no longer asserts external provenance.

There is still one bottom panel. **Consultant view** displays the recognized
consultant section; **Technical evidence view** displays the complete plain-text
response and an optional local slot-to-predictor key. If the expected consultant
heading is absent, the complete response is shown with a visible explanation,
not silently truncated. View changes never call the provider or add names to
the payload. Deterministic Model insights and local audit downloads are separate
from LLM output; snapshot summaries are never included automatically.

The former selected-tree/node/trace contract remains implemented and tested
internally, but is no longer exposed as a second workspace panel. The notes
about that legacy contract below are not instructions for the current UI.
Its approval cannot authorize a model-explanation request.

## Approved default and local architecture (2026-10-14)

The owner selected **GitHub Copilot via the official SDK/local CLI as default**,
retaining **Anthropic as an explicitly selected alternative**. Both use the
previously approved loopback-only backend. There is **no silent fallback**,
browser credential, internal/reverse-engineered Copilot endpoint, retired
GitHub Models endpoint, or reuse of this chat's identity.

Import, deterministic analysis, routes and unverified scoring previews remain
browser/worker-local, usable without AI. AI is off initially. Opt-in checks only
the local configuration, without starting an SDK runtime or making inference.
Every send requires acknowledgement of the selected destination, terms and
disclosed runtime additions, exact application-message approval, and separate
one-request approval for numeric profile values. Provider/model/context changes
abort pending requests and clear approval. Commentary never changes calculations.

Automated tests use synthetic context, an injected SDK mock and mocked Anthropic
transport; they do not perform real provider inference or use a real credential.
Individually owner-approved live synthetic diagnostics are recorded separately
below, not generalized to private-model acceptance. Credential presence is not
verified authentication, entitlement, billing,
answer quality, organization permission or account retention coverage.

## User-supplied v6.4 adaptation and whole-model evidence

The internal selected-context contract uses a **v6.4 local-evidence adaptation** of the owner's attached
audit instructions. It preserves evidence-linked claims, uncertainty/
alternative explanations, informational platform baselines, the raw/calibrated/
arbitrated score distinction and the "For the CDH consultant" call-out.
It is **not a verbatim full-audit executor**: no Python/file tools, complete
Sections 0-13 audit, charts, standalone HTML or generated audit manifest is claimed.
No unseen gain, calibration, IH threshold, named action, interaction, AUC interval
or severity verdict may be invented. Provider adherence still requires human review.

Every accepted imported tree/node is traversed **locally in the import worker**,
once at import for this evidence computation. All context selections include the
same whole-model evidence plus the selected overview/tree/node/trace facts.
Selecting a tree never substitutes that tree for the model-wide evidence.
Neither mode sends raw JSON. The model-level mode uses the bounded v6.4
adaptation with the same evidence, without any selected tree/node/trace/profile.

`modelEvidence` is a bounded computed evidence dictionary with:

- Complete tree/node/internal/leaf counts, file bytes, binary-tree invariant,
  split-kind/missing-check counts, numeric-looking/singleton membership counts,
  leaf-depth histogram, stump count and root count checks.
- Positive/negative/total counts when supplied, base success rate computed as
  positives divided by total, exported success rate and exported pooled-AUC field.
  These are metadata/evidence, not a certification of monitoring semantics.
- Internal-gain total, missing/negative internal and missing/nonzero leaf gains,
  export-order quarter shares, per-tree half means and normalized predictor-gain entropy.
- Redacted top eight predictor slots with gain shares, split/root counts and
  mean split depth. All predictors contribute to global totals and five mutually
  exclusive namespace categories, even when the top table is truncated.
- Root-score decay ratio and the separate root-score sum/base-rate-logit operands
  and residual. Root-score diagnostics are **not per-record ensemble predictions**.

For reproducibility: quarters use the first/last `max(1, ceil(treeCount/4))`
trees in export order; first half uses `ceil(treeCount/2)`, second half the rest.
Decay divides mean absolute root score in the last up-to-ten trees by the first
up-to-ten; windows overlap for small ensembles. Entropy is Shannon entropy of
predictor internal-gain shares divided by log(distinct predictor count).
Zero-denominator, missing/negative required gain and nonfinite sums yield
**null/unavailable**, not a fabricated zero/healthy verdict. Root counters are
not treated as validated node-age or ADWIN-window measurements.
Top rows use gain order when available, otherwise split frequency, with stable
slot tie-breaking. Only gain-share overshoot within `1e-10` of one is normalized
for floating-point accumulation order; material out-of-range evidence is rejected.
Optional AI contract failures are visible and disable sending, not local analysis.

AI namespace buckets use known py-context fields, IH, Customer, Param and other.
The local analytics separately retain literal prefixes, provisional name-based
roles and unverified upstream provenance; arbitrary literal names are not sent.
Names, categories, split strings, thresholds, versions and timestamps are withheld.
Consequently, detailed named-IH/action/interaction audits remain unavailable.
The importer admits explicit `is Missing` conditions and rejects duplicate JSON
keys; it still rejects unsupported schema constructs instead of assuming parity.

The server independently validates bounds, keys, enums and supplied-evidence
consistency and reconstructs both provider bodies. It cannot reparse/verify the
original file because that file never reaches it. Worst-depth evidence plus
maximum bounded trace/profile context remains below the unchanged 12,000-byte
selected-commentary request limit. The model-explanation limit is separately
128 KiB, including the compact v6.4 instruction adaptation. Contract revision
`agb-v6.4-local-evidence-v5` detects an older running
bridge and explicitly requires restart rather than attempting a mismatched send.
Restart the credential-configured bridge and reopen the model after upgrading;
the app does not read or restart a user process with extracted credentials.

## Supported Copilot contract and isolation

The exact dependency is `@github/copilot-sdk` **1.0.21**, bundling runtime
**1.0.97**. Configuration is checked against the installed package declarations.
Official references: [getting started](https://github.com/github/copilot-sdk/blob/v1.0.21/docs/getting-started.md),
[Node SDK](https://github.com/github/copilot-sdk/tree/v1.0.21/nodejs),
[authentication](https://github.com/github/copilot-sdk/blob/v1.0.21/docs/auth/authenticate.md),
[server isolation](https://github.com/github/copilot-sdk/blob/v1.0.21/docs/setup/multi-tenancy.md),
and [session persistence](https://github.com/github/copilot-sdk/blob/v1.0.21/docs/features/session-persistence.md).
Current `main` can differ from the pinned installed version.

- The SDK owns a separate stdio runtime, not this application's/chat's CLI.
  `model: auto` is the official documented selection; account policy controls
  actual model routing. No arbitrary model, provider URL or remote runtime is allowed.
- A fresh workspace and configuration/home under the system temp directory
  are created per request, outside the project. Empty SDK mode plus explicit
  `availableTools: []` and excluded tool patterns denies built-in/custom/MCP tools.
  All permissions and pre-tool hooks deny; unexpected tool activity fails closed.
- Config discovery, file/git context, custom instructions, skills/plugins/agents/
  file hooks, extensions/canvas, memory, shared session store, embedding persistence,
  session telemetry and remote session export are disabled. Application system
  instruction uses supported full replacement. No file or shell tools are supplied.
- Only a minimal OS runtime environment and isolated home/config paths reach
  the child. The server explicitly supplies `COPILOT_GITHUB_TOKEN` to the SDK;
  `useLoggedInUser: false` prevents stored-login/gh fallback. Ambient `GH_TOKEN`,
  `GITHUB_TOKEN`, internal API overrides and Anthropic credentials are excluded.
  **This strict identity choice does not automatically use your ordinary CLI
  login.** Configure an explicitly approved GitHub credential supported by your
  Copilot account/policy; never extract tokens from this chat or bypass entitlement.
- Credential status is local presence only. Actual auth is checked by the
  owned SDK runtime when you approve a send; subscription, organization policy
  and usage limits must admit the operation.
- The preview is the exact **application system message and prompt**, not the
  complete upstream wire request. SDK/runtime adds service/safety/routing
  instructions and metadata. This is disclosed before consent, not hidden.
- Disconnect and delete the owned session, stop/force-stop its runtime, and remove its exact
  ephemeral directory after completion, failure, timeout or cancellation.
  A bounded shutdown waits for admitted requests to finish cleanup. This is
  not an OS sandbox or guaranteed secure erasure: crashes, OS traces, backups,
  privileged local programs and provider retention remain outside these controls.
- The app does not retry or switch provider automatically; the runtime error
  hook aborts rather than requesting retries, and automatic model-switch
  approval is denied. Provider/runtime internal routing and transport behavior
  are not promised to be a one-to-one billable API-call mapping.

## Local server credentials and setup

Use Node.js 24 and `npm ci`. Credentials belong only in the local server
environment, set through a trusted secret manager or a masked local prompt.
Never put them in chat, browser, source, shell-history literals, `VITE_*`,
or a committed `.env`. This server does not load `.env` or expose credentials.

```powershell
npm run build
$secret = Read-Host 'Approved Copilot GitHub credential (local server only)' -AsSecureString
$env:COPILOT_GITHUB_TOKEN = [System.Net.NetworkCredential]::new('', $secret).Password
try { npm run start:local }
finally { Remove-Item Env:\COPILOT_GITHUB_TOKEN; $secret.Dispose() }
```

Open `http://127.0.0.1:5183/`. Without credentials, deterministic analysis still
works and AI shows setup instructions. Restart to change credentials. For the
Anthropic alternative, set `ANTHROPIC_API_KEY` with the same masked technique,
then explicitly select Anthropic in the panel; its key is never passed to Copilot.

For development run `npm run dev -- --host 127.0.0.1 --port 5178 --strictPort`.
Start the bridge separately with
`$env:AGB_UI_ORIGIN = 'http://127.0.0.1:5178'`; Vite proxies `/api/ai` to 5183.
Production serves built assets and API under one origin, browser CSP
`connect-src 'self'`. For `/ExperienceAGB/`, build with
`npm run build -- --base=/ExperienceAGB/` and set `AGB_HOST_BASE=/ExperienceAGB/`
before startup. Restore the normal build/base afterward. Neither service may
be publicly/LAN tunneled or bound to `0.0.0.0`. The static-only host has no AI.

## Anthropic explicit alternative

The owner-approved October 9 contract is retained:
[Messages](https://platform.claude.com/docs/en/api/messages) at
`POST https://api.anthropic.com/v1/messages`, JSON, server-only `x-api-key`,
`anthropic-version: 2023-06-01`. Default `claude-haiku-5-5`;
`ANTHROPIC_MODEL=claude-sonnet-5-5` is the only alternative server allowlist entry.
The preview includes the entire rebuilt provider body: top-level system,
one user message, `max_tokens: 500`, `stream: false`, no tools/files/history/cache.
Native Node fetch rejects redirects and retries none. Fixed errors replace
provider diagnostics; unsupported, tool-bearing or incomplete output fails closed.

## Minimized payload and boundaries

Shared validation reconstructs and compares each selected-provider payload
independently at the server. Arbitrary instructions/models/tools/destinations/
extra fields, raw exports and context strings are rejected on the minimized
commentary route. The separate model-explanation route has its own exact schema,
evidence approval and finite evidence/body limits; it is not an arbitrary proxy
or raw-export upload endpoint.

- Overview: bounded tree/predictor/node counts/depth.
- Every selection: the complete-model computed evidence summary above; no raw
  export, arbitrary strings, predictor identities or unbounded per-node rows.
- Tree: ordinal, node/leaf counts and serialized leaf-score range.
- Node: ordinal, kind, score/sample count and operator enum.
- Trace: at most 32 branches, fixed issue enums, finite local computed scores,
  completion and unverified propensity; no predictor/category names/thresholds.
- Profile: at most 16 numeric step values, ordinal and branch, separately approved;
  text is `[redacted]`. Numeric patterns remain sensitive: redaction is not anonymity.

Host, loopback address and exact Origin/Fetch Metadata checks; random CSRF; JSON
POST only; no CORS/OPTIONS grant. At most two requests, 12,000-byte body and
3-second body deadline; 90-second total provider/runtime deadline plus bounded SDK cleanup.
Browser status/reply deadlines are 5/145 seconds. Copilot startup/auth/inference
has a 90-second budget, followed by up to 50 seconds of bounded cleanup and
5 seconds of browser delivery headroom; 32 connections maximum. Entering cleanup
ends the inference timer, but does not clear cancellation or a prior timeout.
Anthropic responses are bounded to 65,536 bytes; Copilot streamed commentary
to 32,000 bytes; both final texts to 8,000 characters. Plain React text only,
never HTML/Markdown/link execution or scoring input. No request/response **content**
logging. The local terminal records only a random per-request ID, selected provider
enum, fixed phase/event labels, elapsed milliseconds and fixed final result code.
Failure records may additionally identify the fixed cleanup operation and a
fixed `state-busy`/`state-permission`/`state-timeout`/`state-other` category, or a fixed SDK failure
category described below; no original error text or path is copied.
It never logs keys, CSRF, session IDs, model/profile context, provider diagnostics,
prompts or commentary. Terminal scrollback/OS capture may retain this operational
metadata; the app does not create a diagnostic log file.

### Troubleshooting a timeout

An earlier user attempt timed out while the old bridge enforced **20 seconds for
the entire cycle**, including fresh owned CLI startup/authentication/session creation,
not just inference. Old logs contain startup only, so the precise stalled phase
cannot be reconstructed or claimed as a proven provider/network failure.
The current finite90-second policy and fixed operational phase timing make the
next explicitly approved attempt diagnosable. This is additional waiting time,
not an automatic retry, provider fallback or guarantee of successful inference.
Cancellation, two-request admission and all tool/credential/context boundaries remain.

Restart the credential-configured bridge after updating. The status handshake now
also checks the deadline, rejecting an older running20-second bridge instead of
advertising the longer policy. **Refresh the page and reopen the model**: a page
loaded before the v6.4 update can still hold the old instructions/schema.
Confirm the v6.4 application adaptation, local whole-model coverage, and the
exact payload's `whole-model-v2` evidence before
approving. These mean the entire file was analyzed locally; they do not mean the
original JSON or every split/predictor identity is uploaded.

### Cleanup failures and runtime session expiry

Two owner-tested requests reached generation after successful local startup,
auth-status and session creation, then exited generation after roughly30 seconds.
Both also reported failed runtime cleanup, which the earlier code incorrectly
replaced with a generic provider error. This did not establish a bad token or
prove the original inference failure. The newly retained fixed failure code
before cleanup helps distinguish the two without storing SDK diagnostics.

The adapter also still set the SDK's supported session idle expiry to30 seconds
after increasing the request deadline to90. It now derives a145-second idle
expiry from the browser policy, so idle cleanup cannot precede the permitted
request interval. This is consistent with the observed timing, not a claim of
verified live inference success. The90-second request deadline still applies.

The latest owner-run attempt produced a response passing the adapter's output
checks, but it was withheld when cleanup failed. The former two-second stop
budget interrupted the SDK's documented multi-phase shutdown. Cleanup now uses
supported session disconnect before deletion and allows up to 35 seconds for
graceful stop. Abort/disconnect/delete failures do not skip that stop. Failed
stop still uses only that client's force-stop API. Each operation is bounded
within the 50-second overall cleanup allowance. Exact allocated-state removal
uses Node's native Windows retries (five retries,100 ms linear backoff) and the
remaining overall cleanup time, rather than a separate five-second cap. Native
recursive retries are not a global 1.5-second bound: a timed-out removal may
finish later, and the bridge remains
quarantined rather than admitting another runtime.
An unrecoverable stop/removal now has an explicit cleanup error and blocks
new Copilot runtime creation for that bridge's lifetime. Local analysis and
explicitly selected Anthropic remain separate; there is no automatic fallback.
The frontend shows cleanup failure as an alert next to Send, disables
consent/send, and the status handshake
exposes the blocked state. Resolve owned temporary state and restart the bridge
before retrying. Only the two verified failed-request directories from this
investigation were removed, without reading their contents.

### Historical generation failures after the full-model restart

Two owner attempts on October 14 reached inference after runtime startup,
auth-status and session creation. They failed after approximately 58 and 51
seconds of inference, before the 90-second deadline, then reported disconnect,
delete and graceful-stop cleanup errors. Their final result was `provider`,
not `timeout` or unrecoverable `cleanup`. This does not establish a bad token,
context overflow, provider outage or runtime crash: the prior fixed diagnostics
discarded the distinction, and no raw SDK logs or private requests were recovered
or replayed.

The adapter now distinguishes documented SDK `context_limit` / HTTP 413 errors
from authentication failures, and recognizes the pinned SDK/JSON-RPC's fixed
disconnect, process-exit and idle-timeout exception messages. The UI reports a
context/input-size limit or local runtime disconnect only when that corresponding
signal was observed. Unknown failures remain explicitly uncertain, not a
credential diagnosis. This classification does not enlarge context, truncate the
full model, change the timeout or make a failed provider request succeed.
A structured session error also takes precedence when the SDK throws a generic
exception in the same turn; a regression reproduces the earlier loss of the
specific error in that race. It is not proven to be the cause of the owner attempts.

Terminal failure `detail` is restricted to fixed categories: `runtime-exit`,
`runtime-connection`, `sdk-timeout`, `sdk-network`, `sdk-error`, `session-error`,
`session-context-limit`, `session-authorization`, `session-rate-limit`,
`session-quota`, `hook-model-call`, `hook-tool-execution`, `hook-system`,
`hook-user-input`, `hook-error`, or `session-http-N` for one of the allowlisted HTTP statuses
400/401/402/403/404/408/413/422/429/500/502/503/504/529. Arbitrary SDK error types,
error codes, messages, stacks, URLs, tracing IDs and process stderr are not
emitted. A fixed transport-message match is only a classification signal, not
proof of the underlying cause of a lost connection.

SDK, actual loopback HTTP and browser regressions use injected transports,
never a live provider. The credential-configured bridge must be restarted to
load this server-side diagnostic change. A future user-approved request is
needed to identify the original failure more precisely; there is no automatic
replay, retry or fallback, and each retry requires fresh payload approval.

The subsequent owner attempt (`c9257ba4e607`, October 15) reached inference at
7.5 seconds and emitted an unclassified `session.error` at 52.8 seconds, followed
by recoverable cleanup-operation failures. It finished at 77 seconds with
`provider` / `session-error`, not the application's deadline. That category
establishes a session error event, but neither a context limit nor an
authentication problem. Its original cause cannot be reconstructed from the
retained privacy-safe metadata.

The supported [error hook](https://docs.github.com/en/copilot/how-tos/copilot-sdk/hooks/error-handling)
was already configured to abort with zero retries and suppress raw diagnostics.
It now preserves only a fixed classification before the runtime can wrap the
cause in a generic session error. The first 8,192 characters are inspected in
memory only for exact pinned-SDK transport messages, `fetch failed`, and
anchored Node transport signatures (`connect`/`read`/`write`/`socket` followed by
ECONNRESET/ECONNREFUSED/ENOTFOUND/EAI_AGAIN/ETIMEDOUT). No hostname, path,
arbitrary suffix or raw string is retained or emitted. Unrecognized messages
record only the allowlisted hook origin; these are diagnostic signals, not a
claim about why a network connection failed. Specific structured status/context/
authorization errors take precedence over a generic hook origin. A hook-reported
failure never publishes a later partial answer, even if no session error follows.
The abort/no-retry policy, isolation, full input and model selection are unchanged.
This improves diagnosis, not verified live inference success; another restart
and a user-approved request are needed to observe the underlying live cause.

### Controlled synthetic request and cleanup-budget correction, October 15

The next full-model attempt (`76d508948d02`) again emitted only `session-error`
after about 42 seconds of inference. The owner then explicitly authorized one
separate synthetic request. It used the existing app consent controls, a
generated one-leaf model and small contextual prompt, never a private export or
profile. That request (`8530e6577bdf`) passed response validation after about
27 seconds of inference, then withheld the reply because temporary-state removal
failed. This establishes that the configured Copilot account could return a
valid small response; it does not establish that the complete original prompt
and production export fit the routed model or that the complete flow succeeded.
The bridge quarantined Copilot after cleanup failure; no second live request
or automatic retry was made.

Separate tokenless local probes exercised the actual installed SDK without a
cloud inference call. Startup/status/stop/removal completed successfully. A
second probe used the SDK's documented custom-provider support, pointed only at
a temporary loopback fake OpenAI-compatible server with synthetic data; it
received its fixed reply and removed its own state. This fixture configuration
is not exposed by the application or a change to the default provider.

A failing regression then reproduced a definite lifecycle defect: a successful
reply was discarded when state removal took 5.5 seconds even though almost all
of the promised 50-second cleanup allowance was unused. Removal now uses only
the time remaining after abort/disconnect/delete/stop, within that unchanged
overall allowance. No deletion starts if the allowance is already exhausted.
Deadline expiry is logged as the fixed `state-timeout` category, instead of
`state-other`; the earlier live category did not distinguish these causes.
Replies are still withheld until owned-runtime shutdown and state removal
succeed; exhausted/failed cleanup still quarantines Copilot. The 90-second
inference, 50-second cleanup and 145-second browser deadlines are unchanged.
This corrects the reproduced budget defect, not a proven live full-model
inference cause. Loading the change requires a user restart/token re-entry.

### Full-prompt synthetic success and evidence-only input decision, October 15

After that correction the next owner-run private request (`b20896ab8473`)
still ended in generic `session-error`: inference began at 8,372 ms, failed at
80,349 ms and finished as `provider` at 105,372 ms. No state-removal failure was
reported. The cleanup correction did not solve the original inference failure.

The owner then separately authorized exactly one diagnostic containing the
complete original prompt and a generated 144-byte one-leaf model. Request
`1c245c9620a5` reached inference at 22,583 ms, started cleanup at 88,678 ms
and **succeeded at 97,059 ms**, with a plain-text Regime B explanation visible
in the separate diagnostic browser. Disconnect/delete errors were recoverable;
owned runtime/state cleanup ultimately succeeded. This establishes that the
original prompt and tiny input could pass inference, cleanup and display.
No private export/profile was used and no retry was automatic.

The owner reported the failing export is **6 MB**. No exact tokenizer count,
routed-model limit or provider-specific overflow reason was obtained. Input
size/workload is a strong hypothesis, not a proven context-overflow diagnosis;
the 25 MiB local import limit never guaranteed provider context fit.
Rather than another blind restart/private retry, the owner selected local
whole-model analysis with computed evidence sent to the LLM. The evidence-only
contract at the top of this document supersedes the former raw-transfer mode.
Automated tests use generated forests and mocked provider transports; no new
live request is authorized by this design decision, and no live acceptance of
the new evidence explanation is claimed.

Cancellation cannot recall transferred data or guarantee no charge. Forget,
reload and workspace close clear browser consent/commentary, not server
credentials. Stop the bridge/remove environment variables/revoke credentials
to revoke local access.

## Retention and manual validation

Review the [GitHub Copilot privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-copilot-privacy-statement)
and your plan/organization agreement. Do not assume SDK session deletion erases
provider records. Anthropic's [commercial retention notice](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data),
checked October 9, describes normal 30-day API deletion with agreement, policy
and legal exceptions. No zero-retention, residency, training exclusion or legal
approval is asserted for either provider.

Run `npm test`, `npm run test:server`, `npm run typecheck`, `npm run build`
and production browser tests. Mocked SDK and actual local HTTP tests cover
isolation, no fallback, consent, safe errors, abort/shutdown and cleanup;
they do **not** prove real account inference. A nonsensitive live user request,
through the same per-request UI consent, remains a manual gate.
