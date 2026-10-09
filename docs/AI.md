# Contextual AI — local preview, provider blocked

Checked **2026-10-09**, using only public documentation. No live AI request or export upload was made.

## Requested default: GitHub Copilot, pending architecture authorization

The owner requested GitHub Copilot as the default for future live commentary.
The [official SDK](https://github.com/github/copilot-sdk) communicates over JSON-RPC
with the Copilot CLI runtime and manages that local process. The
[official authentication guidance](https://github.com/github/copilot-sdk/blob/main/docs/auth/README.md)
describes runtime authentication; it does not establish a browser-direct
"Copilot API key" inference contract for this static application.

A browser UI would need a separately authorized **loopback Node bridge** using
the official SDK and approved runtime authentication. That changes the current
static architecture. Authorization for that bridge is pending, so **no bridge,
Copilot credential entry, internal endpoint, or live Copilot request is implemented**.
No credential configuration, broader token, reverse-engineered API or silent
provider substitution is used to bypass this decision. The existing UI and
transport tests remain explicitly historical/local scaffolding.

If authorized later, the bridge needs fresh boundaries: loopback-only binding,
origin/request authorization, no built-in agent tools or file access by default,
bounded previewed context, cancellation/timeouts, authentication kept out of the
browser, no raw export upload, mock-only acceptance and independent security
review. SDK defaults include agent tools, so a commentary integration cannot
assume the default runtime is a tool-free text completion service.

## Current contract: no supported GitHub Models API

[GitHub Models public status](https://docs.github.com/en/github-models) states:
“As of July 30, 2026, GitHub Models has been fully retired.”
The inference API, catalog, playground and BYOK are unavailable to all customers.
Both [REST inference documentation](https://docs.github.com/en/rest/models/inference?apiVersion=2022-11-28)
and [prototyping documentation](https://docs.github.com/en/github-models/prototyping-with-ai-models)
redirect to that retirement notice. GitHub Copilot is a separate service; a Copilot subscription is not a Models API credential.

Consequently there is **no current approved inference endpoint, model catalog, token type or supported minimum scope**.
Do not enter a real token. Do not create broader credentials to try to bypass retirement.
The historical `POST https://models.github.ai/inference/chat/completions` destination is fixed in the local preview,
not advertised as a working current contract. Its proposed JSON contains explicit `model`,
system/user `messages`, `stream: false`, and `max_tokens: 500`.
No catalog lookup, inference call, redirect or alternative provider is wired into the app.
Production `requestCommentary()` always returns the retirement error before any network operation.

Historical fine-grained Models **read** / `models:read` permission is the least-privilege policy
for a future *supported and independently verified* Models-like integration, not a currently supported credential recommendation.
The app neither requests repository/write scopes nor assumes classic PAT, OAuth, installation token or Copilot credential compatibility.
[GitHub token permission guidance](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
requires endpoint-specific permission verification; organization policies, approval, account access and usage limits remain separate gates.
Never increase scopes simply because authorization fails.

## Local user journey

AI is disabled initially. Enabling reveals explicit provider/model selection, a disabled session token field,
context selection, terms responsibility and exact proposed destination/JSON body. Nothing is submitted.
The availability action requires terms acknowledgement and exact-body approval, then explains the retirement gate.
Selection alone is not approval. Local deterministic facts and unverified scoring disclaimers remain visible.

Context choices are current model overview, current tree, selected node (including diagram/outline navigation)
and current tree trace. Only allowlisted computed facts are included. File names, export tags, timestamps,
metadata, raw model JSON, raw errors, split questions, thresholds, category labels and predictor names are excluded.
Trace routes are capped at 32 branches. Invalid/unavailable node paths or paths deeper than 64 branches
are marked unavailable rather than silently describing a different node.
Profile values are absent by default; a separate per-request opt-in permits at most 16 bounded numeric step values.
All text values are redacted. Slot positions are not predictor names. Numeric values, counts and scores may still be
sensitive or identifying: this is minimization, **not anonymization**. The preview is the exact proposed JSON body.
Token authorization is described separately without exposing the token.

The retired-provider UI does not accept credentials at all. Its disabled password field is only a placeholder.
There is no token state, storage, URL, log, analytics or error reporting.
Forget/disable clears any programmatically injected field value and consent; workspace close/replacement/unmount tears down the component.
Context changes clear request/profile consent. Every attempt clears approval; no automatic retry.
Cancel clears request consent. Context and commentary are not persisted.

## Defensive harness, not an enabled provider

`testHistoricalTransport` in `src/ai/githubModels.testSupport.ts` is an isolated historical-format defense harness with mandatory injected transport.
The app never calls it or injects browser fetch. Tests inject mock responses only.
It fixes the destination, rejects redirects, omits cookies/referrer, uses `no-store`, and sends precisely the previewed body.
It enforces 12 KB request, 64 KiB response and 8,000-character output limits; streamed/SSE responses are unsupported.
Chunked bodies are bounded while reading. A 20-second abort deadline covers fetch and response reads, including mocks that ignore abort.
Cancellation, missing credentials/approval, 401/403, 429, network/CORS, malformed JSON and oversized bodies yield fixed safe messages.
Raw provider/network errors and response headers are never shown; no automatic retries or arbitrary URLs.
An allowlisted prompt treats context as untrusted data and forbids recalculation/certification/tools/secrets.
Export instructions never enter the payload. This is not a guarantee that a model obeys prompts;
future output must be plain React text, never HTML/Markdown rendering or input to scoring.

## Unresolved release gates

Live AI functionality is **blocked, not complete or certified**. Do not change the retirement guard based on user credentials.
A separately authorized provider change requires fresh current endpoint/schema/model/token verification,
independent security review, public provider/model terms (retention/training, licensing, region/residency, acceptable use),
data-owner/organization approval, and browser CORS testing from the deployment origin without private exports.
Terms responsibility is visible but acknowledgement does not establish legal compliance or permit bypassing service retirement.
The harness is not evidence of live CORS, availability, token acceptance, response correctness or provider approval.
Pega oracle/live-CDH parity remains unverified; AI never upgrades it.

## Mock-only validation

`npm test -- src/ai/context.test.ts src/ai/githubModels.test.ts src/components/ContextualAI.test.tsx`
and `npm run typecheck`.
`e2e/ai.spec.ts` blocks all external requests and checks exact local preview, non-persistence, retirement,
context/profile consent and workspace teardown. No browser test may call a live AI service.
