import { CustomRatio } from './types'
import { STORAGE_KEY } from './constants'
import { appStorage } from '../../utils/appStorage'

export const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const loadCustomRatios = (): CustomRatio[] => {
  return appStorage.getJSON<CustomRatio[]>(STORAGE_KEY, [])
}

export const saveCustomRatios = (ratios: CustomRatio[]) => {
  appStorage.setJSON(STORAGE_KEY, ratios)
  window.dispatchEvent(new Event('allocation-changed'))
}

export const makeDefaultRatio = (): CustomRatio => ({
  id: makeId(),
  name: 'New Ratio',
  scope: 'total',
  groups: [
    { label: 'Group A', classes: [] },
    { label: 'Group B', classes: [] },
  ],
})
