import { useEffect, useMemo, useRef, useState } from 'react';
import type { ContextScope, ContextSource } from '../ai/context';
import { buildContext } from '../ai/context';
import { AIError, buildPayload, GITHUB_MODELS, requestCommentary } from '../ai/githubModels';

export default function ContextualAI({ source, defaultScope }: { source: ContextSource; defaultScope: ContextScope }) {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [scope, setScope] = useState<ContextScope>(defaultScope);
  const [includeProfile, setIncludeProfile] = useState(false);
  const [terms, setTerms] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const tokenInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController>();
  const context = useMemo(() => buildContext(source, scope, includeProfile), [source, scope, includeProfile]);
  const preview = useMemo(() => {
    try { return JSON.stringify(buildPayload(model, context), null, 2); } catch { return ''; }
  }, [model, context]);
  function forget() {
    abort.current?.abort();
    if (tokenInput.current) tokenInput.current.value = '';
    setEnabled(false); setTerms(false); setApproved(false); setIncludeProfile(false); setError(''); setModel(''); setProvider('');
  }
  useEffect(() => () => { abort.current?.abort(); if (tokenInput.current) tokenInput.current.value = ''; }, []);
  useEffect(() => { abort.current?.abort(); setApproved(false); setIncludeProfile(false); setError(''); }, [source, scope]);
  useEffect(() => { setScope(defaultScope); }, [defaultScope]);
  useEffect(() => { setApproved(false); setError(''); }, [preview, terms, provider]);
  useEffect(() => { setIncludeProfile(false); }, [model, provider]);
  async function explain() {
    if (!enabled || !approved || !terms || !provider || !preview) return;
    abort.current?.abort(); abort.current = new AbortController();
    setApproved(false); setIncludeProfile(false);
    try { await requestCommentary(); } catch (cause) { setError(cause instanceof AIError ? cause.message : 'AI unavailable. Deterministic facts remain available.'); }
  }
  return <section className="contextual-ai" aria-label="Contextual AI commentary">
    <h3>Explain this selection with AI</h3>
    <p>Optional commentary only — never a calculation, scoring certification, route or decision. Deterministic facts above remain authoritative for this unverified preview.</p>
    <p className="ai-retired" role="note"><b>GitHub Models is retired.</b> The public documentation reports retirement on July 30, 2026. No supported API or model catalog exists. Sending is blocked; no alternative provider is silently selected. <a href={GITHUB_MODELS.source} target="_blank" rel="noopener noreferrer">Public provider status</a></p>
    <label><input type="checkbox" checked={enabled} onChange={event => event.target.checked ? setEnabled(true) : forget()} /> Enable session-only AI preview (no transmission)</label>
    {enabled && <>
      <p>Credential entry is disabled while this provider is unavailable. Nothing is saved. Closing this workspace or forgetting clears session input and consent.</p>
      <label>Provider<select aria-label="Provider" value={provider} onChange={event => setProvider(event.target.value)}><option value="">Choose explicitly</option><option value="github-models">GitHub Models — retired; preview only</option></select></label>
      <label>Model identifier (preview only; catalog unavailable)<input value={model} maxLength={100} autoComplete="off" spellCheck={false} onChange={event => setModel(event.target.value)} /></label>
      <label>Session token (unavailable for retired provider)<input ref={tokenInput} type="password" disabled autoComplete="off" spellCheck={false} maxLength={256} placeholder="Credential entry disabled" /></label>
      <button className="button button-quiet" onClick={forget}>Forget token and disable AI</button>
      <label>Context selection<select aria-label="Context selection" value={scope} onChange={event => setScope(event.target.value as ContextScope)}><option value="model">Current model overview</option><option value="tree">Current tree</option><option value="node">Selected node</option><option value="trace">Current tree trace</option></select></label>
      <p>Raw model JSON, filenames, metadata, predictor names, category labels, split strings and provider errors are excluded. Context is bounded; tree/trace numbers and scores may still be sensitive. Redaction is not anonymity.</p>
      {scope === 'trace' && <label><input type="checkbox" checked={includeProfile} onChange={event => { setIncludeProfile(event.target.checked); setApproved(false); }} /> Include up to 16 numeric profile step values for this one request. Text values stay redacted; numeric values may identify people.</label>}
      <label><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /> I am responsible for data-sharing approval, provider/model terms, retention, region, organization policy and token scope. Model/provider selection alone is not approval.</label>
      <div className="ai-preview"><b>Exact proposed destination (historical; sending blocked)</b><code>{GITHUB_MODELS.endpoint}</code><p>POST · Content-Type: application/json · Token-based authorization header omitted from preview · no cookies · redirects rejected</p><b>Exact proposed JSON body</b>{preview ? <pre data-testid="ai-payload">{preview}</pre> : <p>Enter an explicit valid model identifier to preview the body. No model is assumed.</p>}</div>
      <label><input type="checkbox" checked={approved} disabled={!preview || !provider || !terms} onChange={event => setApproved(event.target.checked)} /> I reviewed and approve this exact destination and JSON body for one request (provider remains blocked).</label>
      <button className="button button-quiet" onClick={() => void explain()} disabled={!approved || !terms || !preview || !provider}>Check provider availability (no request)</button>
      <button className="button button-quiet" onClick={() => { abort.current?.abort(); setApproved(false); setIncludeProfile(false); setError('Request cancelled.'); }}>Cancel and clear request consent</button>
      {error && <p role="status">{error}</p>}
      <p>AI commentary unavailable. Keep using the local exploration and profile trace. Retry requires fresh approval; retirement cannot be bypassed.</p>
    </>}
  </section>;
}
