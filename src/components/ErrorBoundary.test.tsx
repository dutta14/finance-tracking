import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test error')
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
})
