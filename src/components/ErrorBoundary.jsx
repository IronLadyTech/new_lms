import { Component } from 'react';

const MAX_SILENT_RETRIES = 3;

/**
 * App-wide error boundary — retries silently first so learners never see a
 * scary full-page error for transient data/render glitches. Only shows the
 * fallback after repeated failures.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, showError: false, errorMessage: '' };
    this.failureCount = 0;
    this.retryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      showError: false,
      errorMessage: error?.message || 'Unknown error',
    };
  }

  logError(error, info) {
    // eslint-disable-next-line no-console
    console.error('App error boundary caught:', error, info);
    try {
      sessionStorage.setItem(
        'ilms_last_render_error',
        JSON.stringify({
          message: error?.message || 'Unknown error',
          stack: error?.stack || '',
          componentStack: info?.componentStack || '',
          at: new Date().toISOString(),
          failures: this.failureCount,
        })
      );
    } catch {
      /* ignore storage failures */
    }
  }

  scheduleRecovery() {
    clearTimeout(this.retryTimer);
    const delay = this.failureCount >= MAX_SILENT_RETRIES ? 0 : 50;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.failureCount >= MAX_SILENT_RETRIES) {
        this.setState({ showError: true });
        return;
      }
      this.setState({ hasError: false, showError: false, errorMessage: '' });
    }, delay);
  }

  componentDidCatch(error, info) {
    this.failureCount += 1;
    this.logError(error, info);
    this.scheduleRecovery();
  }

  componentWillUnmount() {
    clearTimeout(this.retryTimer);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.hasError && !this.state.hasError && !this.state.showError) {
      this.failureCount = 0;
    }
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.failureCount = 0;
      clearTimeout(this.retryTimer);
      this.setState({ hasError: false, showError: false, errorMessage: '' });
    }
  }

  handleReload = () => {
    this.failureCount = 0;
    clearTimeout(this.retryTimer);
    this.setState({ hasError: false, showError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.showError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__card">
            <h1 className="error-boundary__title">Something went wrong</h1>
            <p className="error-boundary__text">
              The page hit an unexpected error. Reloading usually fixes it. If it keeps happening,
              contact support at admin@iamironlady.com.
            </p>
            {import.meta.env.DEV && this.state.errorMessage ? (
              <p className="muted error-boundary__detail">
                <code>{this.state.errorMessage}</code>
              </p>
            ) : null}
            <div className="error-boundary__actions">
              <button type="button" className="btn btn-primary" onClick={this.handleReload}>
                Reload
              </button>
              <a href="/app/home" className="btn btn-outline">
                Go to home
              </a>
            </div>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="loading-screen" aria-busy="true" aria-live="polite">
          <div className="spinner" />
          <p>Loading…</p>
        </div>
      );
    }

    return this.props.children;
  }
}
