import { AssetAllocation } from '../data/types'

export type Scope = 'total' | 'fi' | 'gw'

export type GoalOwner = 'primary' | 'partner'

export interface GradualGoal {
  type: 'gradual'
  owner: GoalOwner
  startAge: number
  endAge: number
  /** pct per group index at start — must sum to 100 */
  startPcts: number[]
  /** pct per group index at end — must sum to 100 */
  endPcts: number[]
}

export interface ConstantGoal {
  type: 'constant'
  /** pct per group index — must sum to 100 */
  pcts: number[]
}

export type RatioGoal = GradualGoal | ConstantGoal

export interface CustomRatio {
  id: string
  name: string
  scope: Scope
  groups: { label: string; classes: AssetAllocation[] }[]
  goals?: Partial<Record<Scope, RatioGoal>>
}

export interface RatioPreset {
  id: string
  name: string
  scope: Scope
  groups: { label: string; classes: AssetAllocation[]; color: string }[]
}
