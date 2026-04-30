import { useContext } from 'react'
import { FlagContext } from './FlagContext'
import type { FlagDefinition, FlagType } from './flagSystem'

export function useFlag<T extends FlagType>(flag: FlagDefinition<T>): FlagDefinition<T>['default'] {
  const { resolveFlag } = useContext(FlagContext)
  return resolveFlag(flag)
}
