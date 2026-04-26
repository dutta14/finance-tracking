import { useState, useCallback, useEffect } from 'react'
import type {
  TaxStore,
  TaxYear,
  TaxChecklistItem,
  TaxDocFile,
  TaxDocOwner,
  ChecklistCategory,
  TaxTemplate,
  TaxTemplateItem,
} from './types'
import { EMPTY_STORE, getEmptyYear, loadTemplates, saveTemplates } from './types'
import { saveFileContent, deleteFileContent, deleteMultipleFiles } from '../../utils/taxFileDB'

const STORAGE_KEY = 'tax-store'

function load(): TaxStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : EMPTY_STORE
  } catch {
    return EMPTY_STORE
  }
}

function save(store: TaxStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

let uid = Date.now()
function nextId(): string {
  return String(++uid)
}

/** One-time migration: move base64 content from localStorage to IndexedDB */
async function migrateContentToIndexedDB(store: TaxStore): Promise<TaxStore> {
  let migrated = false
  const next: TaxStore = JSON.parse(JSON.stringify(store))
  for (const [, yearData] of Object.entries(next.years)) {
    for (const item of yearData.items) {
      for (const file of item.files) {
        if (file.content) {
          await saveFileContent(file.id, file.content)
          file.content = undefined
          migrated = true
        }
      }
    }
  }
  if (migrated) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

/** Collect all file IDs for a given year */
function collectFileIds(yearData: TaxYear): string[] {
  const ids: string[] = []
  for (const item of yearData.items) {
    for (const file of item.files) ids.push(file.id)
  }
  return ids
}

export function useTaxStore() {
  const [store, setStore] = useState<TaxStore>(load)
  const [migrating, setMigrating] = useState(false)

  // Run one-time migration on mount
  useEffect(() => {
    let cancelled = false
    const initial = load()
    const hasContent = Object.values(initial.years).some(yr => yr.items.some(item => item.files.some(f => !!f.content)))
    if (!hasContent) return
    setMigrating(true)
    migrateContentToIndexedDB(initial)
      .then(() => {
        if (!cancelled) {
          // Use functional update: re-read from localStorage to pick up any
          // concurrent writes (e.g. user uploaded a file during migration),
          // then strip content fields that were migrated to IndexedDB.
          setStore(() => {
            const current = load()
            for (const yearData of Object.values(current.years)) {
              for (const item of yearData.items) {
                for (const file of item.files) {
                  if (file.content) file.content = undefined
                }
              }
            }
            save(current)
            return current
          })
          setMigrating(false)
        }
      })
      .catch(() => {
        if (!cancelled) setMigrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback((next: TaxStore) => {
    setStore(next)
    save(next)
    window.dispatchEvent(new Event('tax-store-changed'))
  }, [])

  const getYear = useCallback(
    (year: number): TaxYear => {
      return store.years[year] ?? getEmptyYear()
    },
    [store],
  )

  const ensureYear = useCallback(
    (year: number) => {
      if (store.years[year]) return
      const next = { ...store, years: { ...store.years, [year]: getEmptyYear() } }
      persist(next)
    },
    [store, persist],
  )

  const createYearWithDefaults = useCallback(
    (year: number, defaultItems: { label: string; owner: TaxDocOwner; category: ChecklistCategory }[]) => {
      if (store.years[year]) return
      const items: TaxChecklistItem[] = defaultItems.map(d => ({
        id: nextId(),
        label: d.label,
        owner: d.owner,
        category: d.category,
        accountIds: [],
        files: [],
      }))
      const next = { ...store, years: { ...store.years, [year]: { items } } }
      persist(next)
    },
    [store, persist],
  )

  const yearExists = useCallback(
    (year: number): boolean => {
      return !!store.years[year]
    },
    [store],
  )

  const addItem = useCallback(
    (year: number, label: string, owner: TaxDocOwner, category: ChecklistCategory, accountIds: number[] = []) => {
      const yr = store.years[year] ?? getEmptyYear()
      const item: TaxChecklistItem = { id: nextId(), label, owner, category, accountIds, files: [] }
      const next = { ...store, years: { ...store.years, [year]: { ...yr, items: [...yr.items, item] } } }
      persist(next)
      return item
    },
    [store, persist],
  )

  const removeItem = useCallback(
    (year: number, itemId: string) => {
      const yr = store.years[year]
      if (!yr) return
      const next = {
        ...store,
        years: { ...store.years, [year]: { ...yr, items: yr.items.filter(i => i.id !== itemId) } },
      }
      persist(next)
    },
    [store, persist],
  )

  const updateItem = useCallback(
    (year: number, itemId: string, updates: Partial<Pick<TaxChecklistItem, 'label' | 'owner' | 'accountIds'>>) => {
      const yr = store.years[year]
      if (!yr) return
      const next = {
        ...store,
        years: {
          ...store.years,
          [year]: { ...yr, items: yr.items.map(i => (i.id === itemId ? { ...i, ...updates } : i)) },
        },
      }
      persist(next)
    },
    [store, persist],
  )

  const addFileToItem = useCallback(
    (year: number, itemId: string, file: TaxDocFile) => {
      const yr = store.years[year]
      if (!yr) return
      // Strip content from the metadata stored in localStorage
      const metadataFile: TaxDocFile = { ...file, content: undefined }
      const next = {
        ...store,
        years: {
          ...store.years,
          [year]: {
            ...yr,
            items: yr.items.map(i => (i.id === itemId ? { ...i, files: [...i.files, metadataFile] } : i)),
          },
        },
      }
      persist(next)
    },
    [store, persist],
  )

  /** Async version: saves content to IndexedDB, then persists metadata to localStorage */
  const addFileToItemAsync = useCallback(
    async (year: number, itemId: string, file: TaxDocFile) => {
      const yr = store.years[year]
      if (!yr) return
      if (file.content) {
        await saveFileContent(file.id, file.content)
      }
      const metadataFile: TaxDocFile = { ...file, content: undefined }
      const next = {
        ...store,
        years: {
          ...store.years,
          [year]: {
            ...yr,
            items: yr.items.map(i => (i.id === itemId ? { ...i, files: [...i.files, metadataFile] } : i)),
          },
        },
      }
      persist(next)
    },
    [store, persist],
  )

  const removeFileFromItem = useCallback(
    (year: number, itemId: string, fileId: string) => {
      const yr = store.years[year]
      if (!yr) return
      const next = {
        ...store,
        years: {
          ...store.years,
          [year]: {
            ...yr,
            items: yr.items.map(i => (i.id === itemId ? { ...i, files: i.files.filter(f => f.id !== fileId) } : i)),
          },
        },
      }
      persist(next)
      // Clean up IndexedDB (fire-and-forget)
      deleteFileContent(fileId).catch(() => {})
    },
    [store, persist],
  )

  const allYears = Object.keys(store.years)
    .map(Number)
    .sort((a, b) => b - a)

  /* ── Template operations ──────────────────────────────────── */
  const [templates, setTemplates] = useState<TaxTemplate[]>(loadTemplates)

  const persistTemplates = useCallback((next: TaxTemplate[]) => {
    setTemplates(next)
    saveTemplates(next)
  }, [])

  const saveAsTemplate = useCallback(
    (name: string, year: number) => {
      const yr = store.years[year]
      if (!yr) return
      const items: TaxTemplateItem[] = yr.items.map(i => ({
        label: i.label,
        owner: i.owner,
        category: i.category,
      }))
      const tpl: TaxTemplate = { id: String(++uid), name, items }
      persistTemplates([...templates, tpl])
      return tpl
    },
    [store, templates, persistTemplates],
  )

  const updateTemplate = useCallback(
    (templateId: string, year: number) => {
      const yr = store.years[year]
      if (!yr) return
      const items: TaxTemplateItem[] = yr.items.map(i => ({
        label: i.label,
        owner: i.owner,
        category: i.category,
      }))
      persistTemplates(templates.map(t => (t.id === templateId ? { ...t, items } : t)))
    },
    [store, templates, persistTemplates],
  )

  const deleteTemplate = useCallback(
    (templateId: string) => {
      persistTemplates(templates.filter(t => t.id !== templateId))
    },
    [templates, persistTemplates],
  )

  const createYearFromTemplate = useCallback(
    (year: number, template: TaxTemplate) => {
      if (store.years[year]) return
      const items: TaxChecklistItem[] = template.items.map(d => ({
        id: nextId(),
        label: d.label,
        owner: d.owner,
        category: d.category,
        accountIds: [],
        files: [],
      }))
      const next = { ...store, years: { ...store.years, [year]: { items } } }
      persist(next)
    },
    [store, persist],
  )

  const deleteYear = useCallback(
    (year: number) => {
      const yearData = store.years[year]
      if (yearData) {
        const fileIds = collectFileIds(yearData)
        deleteMultipleFiles(fileIds).catch(() => {})
      }
      const { [year]: _, ...rest } = store.years
      persist({ ...store, years: rest })
    },
    [store, persist],
  )

  return {
    store,
    allYears,
    getYear,
    yearExists,
    ensureYear,
    createYearWithDefaults,
    addItem,
    removeItem,
    updateItem,
    addFileToItem,
    addFileToItemAsync,
    removeFileFromItem,
    templates,
    saveAsTemplate,
    updateTemplate,
    deleteTemplate,
    createYearFromTemplate,
    deleteYear,
    migrating,
  }
}
