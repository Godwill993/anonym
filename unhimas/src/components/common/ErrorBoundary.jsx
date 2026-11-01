import { Component } from 'react';
import { MdErrorOutline, MdRefresh } from 'react-icons/md';

/**
 * Global Error Boundary for UNHIMAS.
 * Catches unhandled React rendering errors and displays a recoverable UI
 * instead of a blank white screen. Does not catch event-handler or
 * asynchronous errors (those should be handled with try/catch + toast).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log for developers / future monitoring (Sentry, etc.)
    console.error('[UNHIMAS ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // Prefer a soft reset when possible
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Force a full reload as a reliable recovery path
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--color-bg, #f8fafc)',
            color: 'var(--color-text, #0f172a)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <MdErrorOutline
            size={64}
            style={{ color: 'var(--color-danger, #dc2626)', marginBottom: '1.25rem' }}
            aria-hidden="true"
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p
            style={{
              maxWidth: 420,
              marginBottom: '1.75rem',
              color: 'var(--color-text-muted, #64748b)',
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred in the application. Your data is safe.
            Please try reloading the page. If the problem continues, contact the
            system administrator.
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'var(--color-primary, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            <MdRefresh size={20} aria-hidden="true" />
            Reload Application
          </button>

          {import.meta.env.DEV && this.state.error && (
            <details
              style={{
                marginTop: '2rem',
                maxWidth: 560,
                width: '100%',
                textAlign: 'left',
                background: '#f1f5f9',
                padding: '1rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Developer details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.75rem', overflow: 'auto' }}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
