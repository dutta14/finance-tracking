import { CustomRatio } from './types'
import { ALLOCATION_PATH } from './constants'
import type { FileStore } from '../../utils/fileStoreTypes'

export const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const loadCustomRatios = async (fileStore: FileStore): Promise<CustomRatio[]> => {
  return fileStore.readJSON<CustomRatio[]>(ALLOCATION_PATH, [])
}

export const saveCustomRatios = async (fileStore: FileStore, ratios: CustomRatio[]): Promise<void> => {
  await fileStore.writeJSON(ALLOCATION_PATH, ratios)
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
