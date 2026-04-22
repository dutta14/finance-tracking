import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test error')
  return <div>Content</div>
}

const SyntaxErrorComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new SyntaxError('Unexpected token < in JSON at position 0')
  return <div>Content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders "Reload page" button in page variant', () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })

  it('renders "Clear data & reload" button in page variant', () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /clear data/i })).toBeInTheDocument()
  })

  it('shows error details in collapsed details element', () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    const details = screen.getByText('Show details')
    expect(details).toBeInTheDocument()
    expect(screen.getByText(/Test error/)).toBeInTheDocument()
  })

  it('renders "Retry" button in card variant', () => {
    render(
      <ErrorBoundary variant="card">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('resets error state when resetKey changes (card variant)', () => {
    const { rerender } = render(
      <ErrorBoundary variant="card" resetKey="/old">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument()

    rerender(
      <ErrorBoundary variant="card" resetKey="/new">
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('logs to console.error via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught:',
      expect.any(Error),
      expect.any(String)
    )
  })

  it('catches JSON.parse SyntaxError and renders fallback', () => {
    render(
      <ErrorBoundary variant="page">
        <SyntaxErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/Unexpected token/)).toBeInTheDocument()
  })

  it('card variant does not render the page variant message or buttons', () => {
    render(
      <ErrorBoundary variant="card">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument()
    expect(screen.queryByText('Reload page')).not.toBeInTheDocument()
    expect(screen.queryByText(/clear data/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Show details')).not.toBeInTheDocument()
  })

  it('page variant shows warning text about clearing data', () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText(/This will remove all locally stored data/)).toBeInTheDocument()
    expect(screen.getByText(/GitHub Sync is configured/)).toBeInTheDocument()
  })

  it('"Clear data & reload" calls localStorage.clear and indexedDB.deleteDatabase', () => {
    const clearSpy = vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {})
    const deleteDbSpy = vi.fn(() => ({}) as IDBOpenDBRequest)
    vi.stubGlobal('indexedDB', { deleteDatabase: deleteDbSpy })

    render(
      <ErrorBoundary variant="page">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /clear data/i }))

    expect(clearSpy).toHaveBeenCalled()
    expect(deleteDbSpy).toHaveBeenCalledWith('finance-tracking-files')
  })

  it('details element contains the error message text inside pre', () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    const details = screen.getByText('Show details').closest('details')!
    const pre = details.querySelector('pre')!
    expect(pre.textContent).toContain('Test error')
  })

  it('retry button in card variant resets boundary and re-renders children', () => {
    const { rerender } = render(
      <ErrorBoundary variant="card">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument()

    rerender(
      <ErrorBoundary variant="card">
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
