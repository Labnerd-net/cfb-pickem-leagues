import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Intentionally use console.error rather than the logger abstraction —
    // render crashes must always be visible in the browser console regardless
    // of the VITE_LOG_LEVEL setting (which defaults to 'off').
    console.error('Unhandled render error:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontFamily: 'sans-serif',
            gap: '16px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#666', margin: 0 }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <details style={{ maxWidth: '600px', width: '100%', textAlign: 'left', color: '#666' }}>
            <summary style={{ cursor: 'pointer', textAlign: 'center' }}>Error details</summary>
            <pre
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                overflow: 'auto',
                color: '#c00',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {`${this.state.error.name}: ${this.state.error.message}${this.state.componentStack ?? ''}`}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              borderRadius: '4px',
              border: 'none',
              background: '#1976d2',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
