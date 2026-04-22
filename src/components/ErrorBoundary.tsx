import React from 'react'
import '../styles/ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** 'page' = full-page fallback (used at top-level), 'card' = inline card fallback (used per-route) */
  variant?: 'page' | 'card'
  /** When this key changes, the error state resets (used with card variant for route changes) */
  resetKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleClearAndReload = (): void => {
    localStorage.clear()
    const req = indexedDB.deleteDatabase('finance-tracking-files')
    req.onsuccess = () => window.location.reload()
    req.onerror = () => window.location.reload()
    req.onblocked = () => window.location.reload()
  }

  renderPageFallback(): React.ReactNode {
    const { error } = this.state
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-content">
          <div className="error-boundary-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1>Something went wrong</h1>
          <p>This page encountered an error. You can try reloading, or clear your local data to start fresh.</p>
          <div className="error-boundary-actions">
            <button className="error-boundary-btn error-boundary-btn--primary" onClick={this.handleReload}>
              Reload page
            </button>
            <button className="error-boundary-btn error-boundary-btn--destructive" onClick={this.handleClearAndReload}>
              Clear data &amp; reload
            </button>
          </div>
          <p className="error-boundary-warning">
            This will remove all locally stored data. If GitHub Sync is configured, you can restore from your last sync.
          </p>
          <details className="error-boundary-details">
            <summary>Show details</summary>
            <pre>{error?.message}{'\n'}{error?.stack}</pre>
          </details>
        </div>
      </div>
    )
  }

  renderCardFallback(): React.ReactNode {
    return (
      <div className="error-boundary-card" role="alert">
        <p>Something went wrong on this page.</p>
        <button className="error-boundary-card-btn" onClick={this.resetErrorBoundary}>Retry</button>
      </div>
    )
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.variant === 'card'
        ? this.renderCardFallback()
        : this.renderPageFallback()
    }
    return this.props.children
  }
}

export default ErrorBoundary
