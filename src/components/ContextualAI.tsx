import { useEffect, useMemo, useRef, useState } from 'react';
import type { ContextScope, ContextSource } from '../ai/context';
import { buildContext } from '../ai/context';
import { ANTHROPIC, COPILOT_CLEANUP_TIMEOUT_MS, CommentaryError, ERROR_MESSAGES } from '../ai/anthropic';
import { COPILOT, buildProviderPayload, isProvider } from '../ai/providers';
import type { ProviderId } from '../ai/providers';
import { AUDIT_PROMPT_LABEL } from '../ai/auditPrompt';
import { FULL_MODEL_SYSTEM } from '../ai/fullModel';
import { prepareFullModelRequest } from '../ai/fullModelRequest';
import { loadAIStatus, requestCommentary, requestModelExplanation } from '../ai/client';
import type { AIStatus } from '../ai/client';

const PROMPT_PAGE_CHARACTERS = 4096;

export default function ContextualAI({ source, defaultScope, modelExplanation = false }: { source: ContextSource; defaultScope: ContextScope; modelExplanation?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<AIStatus>();
  const [provider, setProvider] = useState<ProviderId>('copilot');
  const [checking, setChecking] = useState(false);
  const [scope, setScope] = useState<ContextScope>(defaultScope);
  const [includeProfile, setIncludeProfile] = useState(false);
  const [terms, setTerms] = useState(false);
  const [approvedBody, setApprovedBody] = useState('');
  const [error, setError] = useState('');
  const [commentary, setCommentary] = useState('');
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [previewURL, setPreviewURL] = useState('');
  const [evidenceConsent, setEvidenceConsent] = useState(false);
  const [approvedModelBody, setApprovedModelBody] = useState<Blob>();
  const [promptPage, setPromptPage] = useState(0);
  const [explanationView, setExplanationView] = useState<'consultant' | 'technical'>('consultant');
  const promptPages = Math.ceil(FULL_MODEL_SYSTEM.length / PROMPT_PAGE_CHARACTERS);
  const abort = useRef<AbortController>();
  const generation = useRef(0);
  const selected = status?.providers.find(entry => entry.id === provider);
  const model = selected?.model ?? (provider === 'copilot' ? 'auto' : ANTHROPIC.defaultModel);
  const modelEvidence = source.analysis.modelEvidence;
  const consultantStart = commentary.match(/^(?:\d+[.)]\s*)?For the CDH consultant\s*:?\s*$/im);
  const consultant = consultantStart?.index !== undefined
    ? commentary.slice(consultantStart.index + consultantStart[0].length).split(/^\s*(?:\d+[.)]\s*)?Validation backlog\s*:?\s*$/im)[0].trim()
    : '';
  const contextIdentity = modelExplanation ? modelEvidence ?? source.model : source;
  const { prepared, preparationError } = useMemo(() => {
    if (!enabled || !modelExplanation) return { prepared: undefined, preparationError: '' };
    try {
      return { prepared: prepareFullModelRequest(provider, model, modelEvidence), preparationError: '' };
    } catch (cause) {
      if (!(cause instanceof CommentaryError)) throw cause;
      return { prepared: undefined, preparationError: `Whole-model evidence is unavailable or invalid. Reopen the model to recompute it. No model was sent. ${cause.message}` };
    }
  }, [enabled, modelExplanation, modelEvidence, provider, model]);
  const { payload, preview, payloadError } = useMemo(() => {
    if (modelExplanation) return { payload: null, preview: '', payloadError: '' };
    try {
      const context = buildContext(source, scope, includeProfile);
      const payload = buildProviderPayload(provider, model, context);
      return { payload, preview: JSON.stringify(payload, null, 2), payloadError: '' };
    } catch (cause) {
      if (!(cause instanceof CommentaryError)) throw cause;
      return { payload: null, preview: '', payloadError: cause.message };
    }
  }, [source, scope, includeProfile, provider, model, modelExplanation]);
  function invalidate() {
    generation.current++; abort.current?.abort();
    setApprovedBody(''); setPending(false); setError(''); setCommentary('');
    setApprovedModelBody(undefined); setEvidenceConsent(false);
  }
  function forget() {
    invalidate(); setEnabled(false); setStatus(undefined); setTerms(false); setIncludeProfile(false); setProvider('copilot');
  }
  useEffect(() => () => { generation.current++; abort.current?.abort(); }, []);
  useEffect(() => { invalidate(); setIncludeProfile(false); }, [contextIdentity, scope, provider, model, terms]);
  useEffect(() => { setScope(defaultScope); }, [defaultScope]);
  useEffect(() => {
    setPreviewURL('');
    if (!prepared) return;
    const url = URL.createObjectURL(prepared.preview);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [prepared]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setChecking(true); setStatus(undefined); setError('');
    void loadAIStatus(controller.signal).then(value => {
      if (!controller.signal.aborted) { setStatus(value); setChecking(false); }
    }).catch(cause => {
      if (!controller.signal.aborted) { setError(cause instanceof CommentaryError ? cause.message : ERROR_MESSAGES.network); setChecking(false); }
    });
    return () => controller.abort();
  }, [enabled, refresh]);
  async function explain() {
    const approved = modelExplanation
      ? !!prepared && !!previewURL && evidenceConsent && approvedModelBody === prepared.body
      : !!payload && approvedBody === preview;
    if (!enabled || !status || !selected?.configured || selected.blocked || !terms || !approved || pending) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const requestGeneration = ++generation.current;
    const requestPayload = payload;
    const profileApproved = includeProfile;
    const requestModelBody = prepared?.body;
    setApprovedBody(''); setApprovedModelBody(undefined); setEvidenceConsent(false);
    setPending(true); setError(''); setCommentary('');
    try {
      const text = modelExplanation && requestModelBody
        ? await requestModelExplanation(status, provider, requestModelBody, controller.signal)
        : requestPayload ? await requestCommentary(status, provider, requestPayload, profileApproved, controller.signal)
          : (() => { throw new CommentaryError('request'); })();
      if (!controller.signal.aborted && generation.current === requestGeneration) setCommentary(text);
    } catch (cause) {
      if (cause instanceof CommentaryError && cause.code === 'cleanup' && generation.current === requestGeneration) {
        setStatus(previous => previous ? { ...previous, providers: previous.providers.map(entry => entry.id === provider ? { ...entry, blocked: 'cleanup' as const } : entry) } : previous);
      }
      if (generation.current === requestGeneration) setError(cause instanceof CommentaryError ? cause.message : ERROR_MESSAGES.network);
    } finally {
      if (generation.current === requestGeneration) {
        setPending(false); setIncludeProfile(false); abort.current = undefined;
      }
    }
  }
  return <section className="contextual-ai" aria-label={modelExplanation ? 'Model AI explanation' : 'Contextual AI commentary'}>
    <h3>{modelExplanation ? 'AI explanation of this model' : 'Explain this model and selection with AI'}</h3>
    <p>Optional AI commentary only — never a calculation, scoring certification, route or decision. Deterministic facts remain authoritative for this unverified preview.</p>
    {modelExplanation
      ? <p>Every accepted tree and node is analyzed locally. The LLM receives bounded computed evidence and a v6.4 application adaptation of your audit instructions, not the raw model file or just a selected tree. It explains supplied evidence only. This is not the complete v6.4 Python/HTML audit: unsupported audit results remain PENDING EXECUTION.</p>
      : <p>Prompt: <b>{AUDIT_PROMPT_LABEL}</b>. Evidence covers the entire imported model plus the selected context below. This is evidence-based commentary, not the full v6.4 audit, Python script, charts or HTML report. The raw model file never leaves this device through this redacted-context mode.</p>}
    <p role="note">Local analysis never requires AI. Sending {modelExplanation ? 'computed whole-model evidence' : 'selected context'} to a provider is a cloud data-sharing exception and may incur charges. Credentials stay in the local server, never in this browser.</p>
    <label><input type="checkbox" checked={enabled} onChange={event => event.target.checked ? setEnabled(true) : forget()} /> {modelExplanation ? 'Enable optional whole-model explanation' : 'Enable optional AI commentary for this workspace'}</label>
    {payloadError && <p role="status">AI commentary is unavailable: {payloadError} Local model analysis remains available.</p>}
    {enabled && <>
      <label>Commentary provider<select value={provider} onChange={event => {
        if (isProvider(event.target.value)) { invalidate(); setTerms(false); setIncludeProfile(false); setProvider(event.target.value); }
      }}><option value="copilot">GitHub Copilot (default)</option><option value="anthropic">Anthropic (explicit alternative)</option></select></label>
      <p>{checking ? 'Checking local server configuration (no inference request)...' : !status && error ? 'Local bridge configuration is not ready. See the message below.' : selected?.configured ? 'Server credential configured (not account-verified). No inference request has been made by this configuration check.' : `Set ${provider === 'copilot' ? 'COPILOT_GITHUB_TOKEN' : 'ANTHROPIC_API_KEY'} in the local server environment and restart the bridge. Never enter credentials in this browser or chat.`}</p>
      <p>Provider: <b>{provider === 'copilot' ? 'GitHub Copilot' : 'Anthropic'}</b> · Server model: <b>{model}</b>. Credential source: {selected?.authSource ?? 'selected server environment only'}.</p>
      {status && <p>Request deadline: {status.requestTimeoutMs / 1000} seconds for local runtime startup and provider response; Copilot may then need up to {COPILOT_CLEANUP_TIMEOUT_MS / 1000} seconds for isolated runtime cleanup. Cancellation remains available; no automatic retry.</p>}
      {provider === 'copilot' && <p>The official SDK uses an owned, isolated local runtime, not a browser API-key endpoint. This app does not inherit chat credentials or silently use GH_TOKEN, GITHUB_TOKEN or stored login identities. An explicitly configured, entitled account is required. Tools, shell, file access, MCP, skills, ambient instructions, shared memory and session export are disabled.</p>}
      <button className="button button-quiet" disabled={checking || pending} onClick={() => { invalidate(); setIncludeProfile(false); setRefresh(value => value + 1); }}>Recheck local configuration</button>
      <button className="button button-quiet" onClick={forget}>Forget commentary and disable AI</button>
      {!modelExplanation && <><label>Additional selected context<select aria-label="Context selection" value={scope} onChange={event => {
        const value = event.target.value;
        if (value === 'model' || value === 'tree' || value === 'node' || value === 'trace') { invalidate(); setScope(value); }
      }}><option value="model">Current model overview</option><option value="tree">Current tree</option><option value="node">Selected node</option><option value="trace">Current tree trace</option></select></label>
      <p>{source.analysis.modelEvidence ? `Whole-model evidence: ${source.analysis.modelEvidence.coverage.trees} trees, ${source.analysis.modelEvidence.coverage.nodes} nodes analyzed locally. Aggregate gain, structure, monitoring and namespace facts are included regardless of the selection; only eight redacted top-predictor rows are disclosed.` : 'Whole-model evidence is unavailable for this workspace. Reopen the model to compute it; commentary must not invent it.'}</p>
      <p>Raw exports, filenames, model-version/update-time identifiers, predictor names, categories, split strings and thresholds are excluded. Whole-model monitoring counts/rates, structural/gain summaries and selected tree/trace numbers can still be sensitive. Redaction is not anonymity.</p>
      {scope === 'trace' && <label><input type="checkbox" disabled={pending} checked={includeProfile} onChange={event => { invalidate(); setIncludeProfile(event.target.checked); }} /> Include up to 16 numeric profile step values for this one request. Text values stay redacted; numeric values may identify people.</label>}</>}
      {modelExplanation && <>
        {modelEvidence && <p>Local coverage: {modelEvidence.coverage.trees.toLocaleString()} trees / {modelEvidence.coverage.nodes.toLocaleString()} nodes{modelEvidence.coverage.fileBytes !== null ? ` from ${modelEvidence.coverage.fileBytes.toLocaleString()} input bytes` : ''}. All accepted trees and nodes contribute to aggregates; up to eight redacted top-predictor rows are disclosed.</p>}
        <p>{prepared ? `Computed evidence: ${prepared.evidenceBytes.toLocaleString()} UTF-8 bytes. Complete request including the v6.4 adaptation: ${prepared.body.size.toLocaleString()} bytes (128 KiB maximum). No raw JSON is included. Provider context and request deadlines still apply; no automatic retry.` : 'The evidence request is not ready. No model was sent.'}</p>
        <p>Names, category values, split strings, thresholds, export identifiers, timestamps, local filename and customer profile are excluded. Monitoring counts/rates and structural/gain aggregates may still be sensitive. Redaction is not anonymity; approve only evidence you are allowed to share.</p>
        {preparationError && <p role="alert">{preparationError}</p>}
      </>}
      <label><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /> I am responsible for data-sharing approval, provider terms, retention, region, organization policy, runtime additions and charges. Provider selection alone is not approval.</label>
      <p>The provider may retain inputs/outputs under its policies; this app cannot guarantee zero retention. Review <a href={provider === 'copilot' ? 'https://docs.github.com/en/site-policy/privacy-policies/github-copilot-privacy-statement' : 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data'} target="_blank" rel="noopener noreferrer">provider retention</a> and your account agreement before sending. SDK state is isolated and deleted per request; crash remnants, backups and OS traces are not guaranteed erased.</p>
      <div className="ai-preview"><b>Provider destination</b><code>{provider === 'copilot' ? COPILOT.destination : ANTHROPIC.endpoint}</code>{provider === 'copilot' ? <p>Exact application system message and prompt below, not the full upstream wire protocol. SDK/runtime service, safety and routing instructions are additional. Auto selects the model under account policy. No repository context, tools, skills or extensions.</p> : <p>POST · Content-Type: application/json · anthropic-version: {ANTHROPIC.version} · server-only x-api-key header omitted · no cookies · redirects rejected · no tools</p>}
        <b>{modelExplanation ? 'v6.4 audit adaptation and application safety instructions' : provider === 'copilot' ? 'Exact application messages' : 'Exact proposed JSON body'}</b>
        {modelExplanation && <div className="pagination">
          <button disabled={promptPage === 0} onClick={() => setPromptPage(value => value - 1)}>Previous instruction page</button>
          <span>Instructions page {promptPage + 1} / {promptPages}. The complete instructions and computed evidence are in the exact payload download; this view shows one bounded page.</span>
          <button disabled={promptPage + 1 >= promptPages} onClick={() => setPromptPage(value => value + 1)}>Next instruction page</button>
        </div>}
        <pre data-testid={modelExplanation ? 'model-explanation-prompt' : 'ai-payload'} tabIndex={0} role="region" aria-label={modelExplanation ? 'Model explanation instructions' : 'Exact AI request preview'}>{modelExplanation ? FULL_MODEL_SYSTEM.slice(promptPage * PROMPT_PAGE_CHARACTERS, (promptPage + 1) * PROMPT_PAGE_CHARACTERS) : preview}</pre>
        {modelExplanation && prepared && <details><summary>Review computed whole-model evidence</summary><pre data-testid="model-explanation-evidence" tabIndex={0} role="region" aria-label="Computed whole-model evidence">{JSON.stringify(modelEvidence, null, 2)}</pre></details>}
        {modelExplanation && previewURL && <p><a href={previewURL} download="agb-model-explanation-evidence-request.json">Review or download the exact full provider payload</a>. This includes the v6.4 adaptation and bounded evidence, not the raw model. Downloading saves a sensitive copy on your device; delete it when finished.</p>}
      </div>
      {modelExplanation ? <>
        <label><input type="checkbox" disabled={pending || !prepared} checked={evidenceConsent} onChange={event => { invalidate(); setEvidenceConsent(event.target.checked); }} /> I approve sending computed whole-model evidence, not the original file, to this cloud provider for one request.</label>
        <label><input type="checkbox" checked={!!prepared && approvedModelBody === prepared.body} disabled={!prepared || !previewURL || !terms || !evidenceConsent || !selected?.configured || !!selected.blocked || pending} onChange={event => setApprovedModelBody(event.target.checked ? prepared?.body : undefined)} /> I reviewed and approve this destination and exact evidence payload, including the v6.4 adaptation and runtime additions, for one request.</label>
        <button className="button button-quiet" onClick={() => void explain()} disabled={!prepared || !previewURL || !selected?.configured || !!selected.blocked || !terms || !evidenceConsent || approvedModelBody !== prepared.body || pending}>Generate approved model explanation</button>
      </> : <>
        <label><input type="checkbox" checked={!!payload && approvedBody === preview} disabled={!payload || !terms || !selected?.configured || !!selected.blocked || pending} onChange={event => setApprovedBody(event.target.checked ? preview : '')} /> I reviewed and approve this destination and exact application payload, including disclosed runtime additions, for one request.</label>
        <button className="button button-quiet" onClick={() => void explain()} disabled={!payload || !selected?.configured || !!selected.blocked || !terms || approvedBody !== preview || pending}>Send approved context once</button>
      </>}
      <button className="button button-quiet" onClick={() => { invalidate(); setIncludeProfile(false); setError(ERROR_MESSAGES.cancelled); }}>Cancel and clear request consent</button>
      {pending && <p role="status">Waiting for selected provider commentary...</p>}
      {(selected?.blocked || error) && <p role="alert">{selected?.blocked ? ERROR_MESSAGES.cleanup : error}</p>}
      {commentary && <div className="ai-commentary" aria-live="polite"><h4>{modelExplanation ? 'AI model explanation — local evidence; not a full executed audit' : 'Unverified AI commentary — not calculation or Pega certification'}</h4>
        <div className="workspace-actions" aria-label="Explanation presentation"><button className="button button-quiet" aria-pressed={explanationView === 'consultant'} onClick={() => setExplanationView('consultant')}>Consultant view</button><button className="button button-quiet" aria-pressed={explanationView === 'technical'} onClick={() => setExplanationView('technical')}>Technical evidence view</button></div>
        {explanationView === 'consultant' && !consultant && <p>No separate consultant section was recognized; the complete response is shown without hiding content.</p>}
        <p style={{ whiteSpace: 'pre-wrap' }}>{explanationView === 'consultant' && consultant ? consultant : commentary}</p>
        {explanationView === 'technical' && modelEvidence && <details><summary>Local predictor alias key (not sent to the provider)</summary><ul>{modelEvidence.predictors.map(row => <li key={row.slot}>Slot {row.slot}: {source.analysis.audit?.predictors[row.slot - 1]?.feature ?? source.analysis.predictors[row.slot - 1]?.feature ?? 'Local name unavailable'} — gain share {row.gainShare === null ? 'not available' : String(row.gainShare)}</li>)}</ul><p>Names resolve locally only. A name is not evidence of business semantics or upstream provenance.</p></details>}
      </div>}
      <p>Each retry requires fresh exact-body approval. Profile-value consent is consumed on completion. Cancellation cannot recall data already sent or guarantee no charge. Closing this workspace clears commentary and consent, not the server key.</p>
    </>}
  </section>;
}
