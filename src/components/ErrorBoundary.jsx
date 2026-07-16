import { Component } from 'react';

/**
 * App-wide error boundary — a render error shows a friendly fallback with a
 * Reload action instead of a blank white screen. (Error boundaries must be
 * class components.)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App error boundary caught:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__card">
            <h1 className="error-boundary__title">Something went wrong</h1>
            <p className="error-boundary__text">
              The page hit an unexpected error. Reloading usually fixes it. If it keeps happening,
              contact support.
            </p>
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
    return this.props.children;
  }
}
