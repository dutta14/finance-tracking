/** Pure calculation functions for SavingsGrowthTracker */

/** YoY percentage delta. Returns null when previous value is 0 (division by zero). */
export function delta(cur: number, prev: number): number | null {
  return prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100
}
