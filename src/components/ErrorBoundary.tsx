import { Component } from 'react';
import type { ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    console.error('ExperienceAGB workspace rendering failed. Model content is not logged.');
  }
  render() {
    if (this.state.failed) {
      return (
        <main className="app-shell recovery-panel">
          <div role="alert">
            <h1>The workspace could not be displayed</h1>
            <p>Your file has not been uploaded or saved. Return to model input to try another export.</p>
          </div>
          <button className="button button-primary" onClick={() => this.setState({ failed: false })}>Return to model input</button>
        </main>
      );
    }
    return this.props.children;
  }
}
