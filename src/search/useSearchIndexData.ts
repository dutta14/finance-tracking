import { useEffect, useMemo, useState } from 'react'
import { useGoals } from '../contexts/GoalsContext'
import { useData } from '../contexts/DataContext'
import { useFileStore } from '../contexts/FileStoreContext'
import { loadTaxStore, TEMPLATES_PATH } from '../pages/taxes/types'
import { ALLOCATION_PATH } from '../pages/allocation/constants'
import type { CategoryGroup } from '../pages/budget/types'
import type { AllocationRatioIndex, SearchIndexData, TaxTemplateIndex, TaxYearIndex } from './searchIndex'

const BUDGET_CATEGORIES_PATH = 'budget/categories.json'

type FileBackedData = Pick<SearchIndexData, 'categoryGroups' | 'taxYears' | 'taxTemplates' | 'allocationRatios'>

const EMPTY: FileBackedData = { categoryGroups: [], taxYears: {}, taxTemplates: [], allocationRatios: [] }

/**
 * Collects everything the universal search index can surface. Only reloads the
 * file-backed slices while `enabled` is true so opening the palette is cheap.
 */
export function useSearchIndexData(enabled: boolean): SearchIndexData {
  const { goals, gwGoals } = useGoals()
  const { accounts } = useData()
  const { fileStore } = useFileStore()
  const [fileData, setFileData] = useState<FileBackedData>(EMPTY)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    Promise.all([
      fileStore.readJSON<{ categoryGroups?: CategoryGroup[] }>(BUDGET_CATEGORIES_PATH, {}),
      fileStore.readJSON<TaxTemplateIndex[]>(TEMPLATES_PATH, []),
      fileStore.readJSON<AllocationRatioIndex[]>(ALLOCATION_PATH, []),
      loadTaxStore(fileStore),
    ])
      .then(([config, taxTemplates, allocationRatios, taxStore]) => {
        if (cancelled) return
        setFileData({
          categoryGroups: config?.categoryGroups ?? [],
          taxTemplates,
          allocationRatios,
          taxYears: taxStore.years as unknown as TaxYearIndex,
        })
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [enabled, fileStore])

  return useMemo(() => ({ goals, gwGoals, accounts, ...fileData }), [goals, gwGoals, accounts, fileData])
}
