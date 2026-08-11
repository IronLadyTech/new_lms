import { Component } from 'react';

/**
 * Catches render errors in route/page content so the app shell (header, nav)
 * keeps working when a single page throws.
 */
export default class LayoutErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const label = this.props.name || 'page';
    // eslint-disable-next-line no-console
    console.error(`LayoutErrorBoundary (${label}) caught:`, error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="alert alert-error" role="alert">
            <strong>This page hit an error.</strong>
            <p className="muted" style={{ margin: '0.5rem 0 0' }}>
              Try another section from the menu, or reload the page. If it keeps happening, contact
              support.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '0.75rem' }}
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
