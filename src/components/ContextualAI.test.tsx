import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContextualAI from './ContextualAI';
import { fixture } from '../ai/contextFixture';
import { ANTHROPIC } from '../ai/anthropic';
import { COPILOT } from '../ai/providers';
import { COMMENTARY_CONTRACT_VERSION } from '../ai/auditPrompt';
const status = { defaultProvider: 'copilot', commentaryContract: COMMENTARY_CONTRACT_VERSION, requestTimeoutMs: 90000, csrf: 'a'.repeat(64), providers: [
  { id: 'copilot', configured: true, blocked: null, model: 'auto', authSource: 'explicit COPILOT_GITHUB_TOKEN (server environment)', destination: COPILOT.destination },
  { id: 'anthropic', configured: true, blocked: null, model: ANTHROPIC.defaultModel, authSource: 'ANTHROPIC_API_KEY (server environment)', destination: ANTHROPIC.endpoint },
] };
let requests: ReturnType<typeof vi.fn>;
beforeEach(() => {
  requests = vi.fn(async (url: string) => url.endsWith('/status') ? Response.json(status) : Response.json({ text: '<script>untrusted</script> https://evil.example' }));
  vi.stubGlobal('fetch', requests);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const enable = async () => {
  fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional/ }));
  await screen.findByText(/Server credential configured/);
};
const approve = () => {
  fireEvent.click(screen.getByRole('checkbox', { name: /I am responsible/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed/ }));
};
describe('selected-provider per-request consent and teardown', () => {
  it('contains invalid optional AI evidence without crashing or contacting a provider', async () => {
    const source = fixture();
    source.analysis.modelEvidence!.coverage.fileBytes = -1;
    render(<ContextualAI source={source} defaultScope="tree" />);
    expect(screen.getByText(/AI commentary is unavailable/)).toBeInTheDocument();
    expect(requests).not.toHaveBeenCalled();
    await enable();
    fireEvent.click(screen.getByRole('checkbox', { name: /I am responsible/ }));
    expect(screen.getByRole('checkbox', { name: /I reviewed/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /I reviewed/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(requests).toHaveBeenCalledTimes(1);
  });
  it('does not contact even the local backend before opt-in and has no key input', async () => {
    render(<ContextualAI source={fixture()} defaultScope="tree" />);
    expect(requests).not.toHaveBeenCalled();
    await enable();
    expect(screen.getByText(/v6.4 local-evidence adaptation/)).toBeInTheDocument();
    expect(screen.getByText(/Whole-model evidence: 1 trees, 3 nodes/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Exact AI request preview' })).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-payload')).toHaveTextContent('"model": "auto"');
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(requests).toHaveBeenCalledTimes(1);
  });
  it('sends only approved exact body once and renders output as plain text, no links or executable markup', async () => {
    const { container } = render(<ContextualAI source={fixture()} defaultScope="tree" />);
    await enable(); approve();
    const payload = JSON.parse(screen.getByTestId('ai-payload').textContent ?? '');
    fireEvent.click(screen.getByRole('button', { name: /Send approved/ }));
    expect(await screen.findByText('<script>untrusted</script> https://evil.example')).toBeInTheDocument();
    expect(container.querySelector('.ai-commentary script, .ai-commentary a')).toBeNull();
    expect(JSON.parse(requests.mock.calls[1][1].body)).toEqual({ provider: 'copilot', payload, approved: true, profileApproved: false });
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
  it('shows missing-key configuration and never submits a request', async () => {
    requests.mockImplementation(async () => Response.json({ ...status, providers: status.providers.map(item => ({ ...item, configured: false })) }));
    render(<ContextualAI source={fixture()} defaultScope="model" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional/ }));
    expect(await screen.findByText(/Set COPILOT_GITHUB_TOKEN/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(requests).toHaveBeenCalledTimes(1);
  });
  it('a cleanup error visibly blocks another approved request instead of claiming credential rejection', async () => {
    requests.mockImplementation(async (url: string) => url.endsWith('/status') ? Response.json(status) : Response.json({ code: 'cleanup', message: 'PRIVATE_PROVIDER_DIAGNOSTIC' }, { status: 503 }));
    render(<ContextualAI source={fixture()} defaultScope="model" />);
    await enable(); approve();
    fireEvent.click(screen.getByRole('button', { name: /Send approved/ }));
    await screen.findByText(/Local Copilot runtime cleanup failed/);
    const failure = screen.getByRole('alert');
    expect(screen.getByRole('button', { name: /Send approved/ }).compareDocumentPosition(failure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('PRIVATE_PROVIDER_DIAGNOSTIC')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I reviewed/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(requests).toHaveBeenCalledTimes(2);
  });
  it('requires restart for an old bridge rather than misleadingly sending the new prompt', async () => {
    requests.mockImplementation(async () => Response.json({ ...status, commentaryContract: 'older-version' }));
    render(<ContextualAI source={fixture()} defaultScope="model" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional/ }));
    await screen.findByText(/local bridge uses an older commentary contract/);
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(screen.queryByText(/Set COPILOT_GITHUB_TOKEN/)).not.toBeInTheDocument();
    expect(requests).toHaveBeenCalledTimes(1);
  });
  it('requires restart when the bridge still uses the old shorter deadline', async () => {
    requests.mockImplementation(async () => Response.json({ ...status, requestTimeoutMs: 20000 }));
    render(<ContextualAI source={fixture()} defaultScope="model" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional/ }));
    await screen.findByText(/local bridge uses an older commentary contract/);
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    expect(requests).toHaveBeenCalledTimes(1);
  });
  it('switching provider aborts in-flight response, clears approval/profile/terms and requires explicit alternative consent', async () => {
    render(<ContextualAI source={fixture()} defaultScope="trace" />);
    await enable(); approve();
    fireEvent.click(screen.getByRole('checkbox', { name: /Include up to/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed/ }));
    let signal: AbortSignal | undefined;
    requests.mockImplementation(async (_url: string, options: RequestInit) => {
      signal = options.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    });
    fireEvent.click(screen.getByRole('button', { name: /Send approved/ }));
    fireEvent.change(screen.getByRole('combobox', { name: /Commentary provider/ }), { target: { value: 'anthropic' } });
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(screen.getByRole('checkbox', { name: /I reviewed/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /I am responsible/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Include up to/ })).not.toBeChecked();
    expect(screen.getByTestId('ai-payload')).toHaveTextContent('"model": "claude-haiku-5-5"');
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    requests.mockImplementation(async () => Response.json({ text: 'Explicit Anthropic alternative.' }));
    approve();
    fireEvent.click(screen.getByRole('button', { name: /Send approved/ }));
    await screen.findByText('Explicit Anthropic alternative.');
    expect(JSON.parse(requests.mock.calls.at(-1)?.[1].body).provider).toBe('anthropic');
  });
  it('context changes invalidate request and separate profile consent and abort pending response', async () => {
    const source = fixture();
    const { rerender } = render(<ContextualAI source={source} defaultScope="trace" />);
    await enable();
    fireEvent.click(screen.getByRole('checkbox', { name: /Include up to/ }));
    approve();
    let signal: AbortSignal | undefined;
    requests.mockImplementation(async (_url: string, options: RequestInit) => {
      signal = options.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    });
    fireEvent.click(screen.getByRole('button', { name: /Send approved/ }));
    rerender(<ContextualAI source={{ ...source, nodeId: 'root' }} defaultScope="trace" />);
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(screen.getByRole('checkbox', { name: /Include up to/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /I reviewed/ })).not.toBeChecked();
    expect(screen.queryByText(/Aborted/)).not.toBeInTheDocument();
  });
  it('redacts provider errors and retry requires fresh consent; disabling clears commentary', async () => {
    render(<ContextualAI source={fixture()} defaultScope="tree" />);
    await enable(); approve();
    requests.mockImplementation(async () => Response.json({ code: 'rate', message: 'raw secret' }, { status: 502 }));
    fireEvent.click(screen.getByRole('button', { name: /Send approved/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('rate or spend limit'));
    expect(screen.queryByText('raw secret')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send approved/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Forget commentary/ }));
    expect(screen.queryByTestId('ai-payload')).not.toBeInTheDocument();
  });
});
