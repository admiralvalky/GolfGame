import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('React Error Boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '2rem auto',
          background: '#2d1515',
          border: '1px solid #7f1d1d',
          borderRadius: '12px',
        }}>
          <h2 style={{ color: '#fca5a5', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{
            background: '#0d1f15',
            border: '1px solid #2d5a3d',
            borderRadius: '8px',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            color: '#86efac',
          }}>
            {this.state.error?.message ?? 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#1a3a2a',
              color: '#f0fdf4',
              border: '1px solid #2d5a3d',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
