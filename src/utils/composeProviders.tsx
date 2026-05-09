import { FC, ReactNode, ComponentType } from 'react'

type ProviderComponent = ComponentType<{ children: ReactNode }>

/**
 * Composes an array of context providers into a single wrapper component.
 * Providers are applied outermost-first: the first provider in the array
 * wraps all subsequent ones (via reduceRight).
 */
export function composeProviders(...providers: ProviderComponent[]): FC<{ children: ReactNode }> {
  const ComposedProviders: FC<{ children: ReactNode }> = ({ children }) =>
    providers.reduceRight<ReactNode>((acc, Provider) => <Provider>{acc}</Provider>, children)

  ComposedProviders.displayName = 'ComposedProviders'
  return ComposedProviders
}
