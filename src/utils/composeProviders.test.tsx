import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createContext, useContext, FC, ReactNode } from 'react'
import { composeProviders } from './composeProviders'

const CtxA = createContext('default-a')
const CtxB = createContext('default-b')
const CtxC = createContext('default-c')

const ProviderA: FC<{ children: ReactNode }> = ({ children }) => (
  <CtxA.Provider value="from-a">{children}</CtxA.Provider>
)

const ProviderB: FC<{ children: ReactNode }> = ({ children }) => (
  <CtxB.Provider value="from-b">{children}</CtxB.Provider>
)

const ProviderC: FC<{ children: ReactNode }> = ({ children }) => (
  <CtxC.Provider value="from-c">{children}</CtxC.Provider>
)

const Consumer: FC = () => {
  const a = useContext(CtxA)
  const b = useContext(CtxB)
  const c = useContext(CtxC)
  return <div data-testid="values">{`${a},${b},${c}`}</div>
}

describe('composeProviders', () => {
  it('renders children with all providers active', () => {
    const Providers = composeProviders(ProviderA, ProviderB, ProviderC)
    render(
      <Providers>
        <Consumer />
      </Providers>,
    )
    expect(screen.getByTestId('values').textContent).toBe('from-a,from-b,from-c')
  })

  it('renders children directly when given no providers', () => {
    const Providers = composeProviders()
    render(
      <Providers>
        <span data-testid="child">hello</span>
      </Providers>,
    )
    expect(screen.getByTestId('child').textContent).toBe('hello')
  })

  it('applies providers outermost-first (first provider wraps all others)', () => {
    // If both provide the same context, the innermost (last) wins
    const Ctx = createContext('default')
    const Outer: FC<{ children: ReactNode }> = ({ children }) => <Ctx.Provider value="outer">{children}</Ctx.Provider>
    const Inner: FC<{ children: ReactNode }> = ({ children }) => <Ctx.Provider value="inner">{children}</Ctx.Provider>
    const Reader: FC = () => <span data-testid="val">{useContext(Ctx)}</span>

    const Providers = composeProviders(Outer, Inner)
    render(
      <Providers>
        <Reader />
      </Providers>,
    )
    expect(screen.getByTestId('val').textContent).toBe('inner')
  })

  it('sets displayName to ComposedProviders', () => {
    const Providers = composeProviders(ProviderA, ProviderB)
    expect(Providers.displayName).toBe('ComposedProviders')
  })

  it('works with a single provider', () => {
    const Providers = composeProviders(ProviderA)
    const Reader: FC = () => <span data-testid="a">{useContext(CtxA)}</span>
    render(
      <Providers>
        <Reader />
      </Providers>,
    )
    expect(screen.getByTestId('a').textContent).toBe('from-a')
  })
})
