import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ContextualAI from './ContextualAI';
import { fixture } from '../ai/contextFixture';
import { COPILOT } from '../ai/providers';
import { ANTHROPIC } from '../ai/anthropic';
import { COMMENTARY_CONTRACT_VERSION } from '../ai/auditPrompt';
import * as preparation from '../ai/fullModelRequest';
beforeEach(() => {
  vi.spyOn(preparation, 'prepareFullModelRequest');
  const NativeURL = URL;
  vi.stubGlobal('URL', class extends NativeURL {
    static createObjectURL() { return 'blob:local-exact-payload'; }
    static revokeObjectURL() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('offers a locally computed whole-model explanation without an automatic provider call', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<ContextualAI source={fixture()} defaultScope="model" modelExplanation />);
  expect(screen.getByRole('heading', { name: 'AI explanation of this model' })).toBeInTheDocument();
  expect(screen.getByText(/Every accepted tree and node is analyzed locally/)).toBeInTheDocument();
  expect(preparation.prepareFullModelRequest).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('does not confuse whole-model evidence consent with selected-context approval', async () => {
  const fetch = vi.fn(async () => Response.json({
    defaultProvider: 'copilot', commentaryContract: COMMENTARY_CONTRACT_VERSION,
    requestTimeoutMs: 90000, csrf: 'a'.repeat(64), providers: [
      { id: 'copilot', configured: true, blocked: null, model: 'auto', authSource: 'explicit server environment', destination: COPILOT.destination },
      { id: 'anthropic', configured: false, blocked: null, model: ANTHROPIC.defaultModel, authSource: 'server environment', destination: ANTHROPIC.endpoint },
    ],
  }));
  vi.stubGlobal('fetch', fetch);
  render(<ContextualAI source={fixture()} defaultScope="model" modelExplanation />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional whole-model/ }));
  await screen.findByText(/Server credential configured/);
  expect(screen.getByRole('checkbox', { name: /I approve sending computed whole-model evidence/ })).not.toBeChecked();
  expect(screen.getByTestId('model-explanation-evidence')).not.toHaveTextContent(/PRIVATE_NAME|SECRET_METADATA|evil.example/);
  expect(screen.getByRole('button', { name: /Generate approved model explanation/ })).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('sends one approved evidence request and keeps the explanation across tree/profile changes', async () => {
  const fetch = vi.fn(async (url: string, _options?: RequestInit) => url.endsWith('/status') ? Response.json({
    defaultProvider: 'copilot', commentaryContract: COMMENTARY_CONTRACT_VERSION,
    requestTimeoutMs: 90000, csrf: 'a'.repeat(64), providers: [
      { id: 'copilot', configured: true, blocked: null, model: 'auto', authSource: 'server environment', destination: COPILOT.destination },
      { id: 'anthropic', configured: false, blocked: null, model: ANTHROPIC.defaultModel, authSource: 'server environment', destination: ANTHROPIC.endpoint },
    ],
  }) : Response.json({ text: '<script>private-response-not-executable</script> https://evil.example' }));
  vi.stubGlobal('fetch', fetch);
  const source = fixture();
  const { rerender, container } = render(<ContextualAI source={source} defaultScope="model" modelExplanation />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional whole-model/ }));
  await screen.findByRole('link', { name: /exact full provider payload/ });
  await screen.findByText(/Server credential configured/);
  fireEvent.click(screen.getByRole('checkbox', { name: /I am responsible/ }));
  expect(screen.getByRole('checkbox', { name: /I reviewed/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve sending computed/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed/ }));
  fireEvent.click(screen.getByRole('button', { name: /Generate approved/ }));
  await screen.findByText('<script>private-response-not-executable</script> https://evil.example');
  expect(fetch.mock.calls[1][0]).toContain('/model-explanation');
  expect(fetch.mock.calls[1][1]?.body).toBeInstanceOf(Blob);
  expect(container.querySelector('.ai-commentary script, .ai-commentary a')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Technical evidence view' }));
  expect(screen.getByText('Local predictor alias key (not sent to the provider)')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Consultant view' }));
  expect(screen.getByRole('checkbox', { name: /I approve sending/ })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: /I reviewed/ })).not.toBeChecked();
  rerender(<ContextualAI source={{ ...source, treeIndex: 1, nodeId: 'root.L' }} defaultScope="model" modelExplanation />);
  expect(screen.getByText(/private-response-not-executable/)).toBeInTheDocument();
  expect(preparation.prepareFullModelRequest).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  rerender(<ContextualAI source={fixture()} defaultScope="model" modelExplanation />);
  expect(screen.queryByText(/private-response-not-executable/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Generate approved/ })).toBeDisabled();
});

it('shows a visible missing-evidence error and never enables a raw-file fallback', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({})));
  const source = fixture();
  delete source.analysis.modelEvidence;
  render(<ContextualAI source={source} defaultScope="model" modelExplanation />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Enable optional whole-model/ }));
  expect(screen.getByText(/Whole-model evidence is unavailable or invalid/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Generate approved/ })).toBeDisabled();
  expect(screen.queryByRole('link', { name: /exact full provider payload/ })).not.toBeInTheDocument();
  await screen.findByText(/Local bridge configuration is not ready/);
});
