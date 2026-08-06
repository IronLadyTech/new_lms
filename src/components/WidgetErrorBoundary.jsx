import { Component } from 'react';

const MAX_RETRIES = 2;

/**
 * Isolates non-critical UI (notification bell, streak widget) so a render
 * error there cannot crash the entire app shell. Retries silently first.
 */
export default class WidgetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.failureCount = 0;
    this.retryTimer = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const label = this.props.name || 'widget';
    // eslint-disable-next-line no-console
    console.error(`WidgetErrorBoundary (${label}) caught:`, error, info);
    this.failureCount += 1;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.failureCount < MAX_RETRIES) {
        this.setState({ hasError: false });
      }
    }, 50);
  }

  componentWillUnmount() {
    clearTimeout(this.retryTimer);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.hasError && !this.state.hasError) {
      this.failureCount = 0;
    }
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.failureCount = 0;
      clearTimeout(this.retryTimer);
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
