export type FlagType = 'boolean' | 'string' | 'number' | 'json'

export interface FlagDefinition<T extends FlagType> {
  id: string
  type: T
  default: T extends 'boolean' ? boolean : T extends 'number' ? number : T extends 'string' ? string : unknown
  description: string
  temporary?: boolean
}

export function defineFlag<T extends FlagType>(
  id: string,
  config: { type: T; default: FlagDefinition<T>['default']; description: string; temporary?: boolean },
): FlagDefinition<T> {
  return { id, ...config }
}
