import { CustomRatio } from './types'
import { STORAGE_KEY } from './constants'

export const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const loadCustomRatios = (): CustomRatio[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export const saveCustomRatios = (ratios: CustomRatio[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratios))

export const makeDefaultRatio = (): CustomRatio => ({
  id: makeId(),
  name: 'New Ratio',
  scope: 'total',
  groups: [
    { label: 'Group A', classes: [] },
    { label: 'Group B', classes: [] },
  ],
})
