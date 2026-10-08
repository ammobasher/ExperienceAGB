import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

it('provides recovery rather than a blank screen after a render failure', async () => {
  let fail = true;
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  function Child() {
    if (fail) throw new Error('private model text must not appear');
    return <h1>Recovered</h1>;
  }
  try {
    render(<ErrorBoundary><Child /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('The workspace could not be displayed');
    expect(screen.queryByText(/private model text/)).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Return to model input' }));
    expect(screen.getByRole('heading', { name: 'Recovered' })).toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});
