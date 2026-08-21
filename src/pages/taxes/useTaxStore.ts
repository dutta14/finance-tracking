import { useState, useCallback, useEffect, useMemo } from 'react'
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
import {
  EMPTY_STORE,
  getEmptyYear,
  loadTaxStore,
  loadTemplates,
  saveTaxYear,
  saveTemplates,
  deleteTaxYear,
  taxFilePath,
  uniqueTaxFileName,
} from './types'
import { useFileStore } from '../../contexts/FileStoreContext'

let uid = Date.now()
function nextId(): string {
  return String(++uid)
}

export function useTaxStore() {
  const { fileStore } = useFileStore()
  const [store, setStore] = useState<TaxStore>(EMPTY_STORE)
  const [templates, setTemplates] = useState<TaxTemplate[]>([])

  useEffect(() => {
    let cancelled = false

    loadTaxStore(fileStore)
      .then(next => {
        if (!cancelled) setStore(next)
      })
      .catch(console.error)

    loadTemplates(fileStore)
      .then(next => {
        if (!cancelled) setTemplates(next)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [fileStore])

  /** Writes a single year file and mirrors it into local state. */
  const persistYear = useCallback(
    (year: number, yearData: TaxYear) => {
      setStore(prev => ({ ...prev, years: { ...prev.years, [year]: yearData } }))
      saveTaxYear(fileStore, year, yearData).catch(console.error)
      window.dispatchEvent(new Event('tax-store-changed'))
    },
    [fileStore],
  )

  const getYear = useCallback((year: number): TaxYear => store.years[year] ?? getEmptyYear(), [store])

  const yearExists = useCallback((year: number): boolean => !!store.years[year], [store])

  const ensureYear = useCallback(
    (year: number) => {
      if (store.years[year]) return
      persistYear(year, getEmptyYear())
    },
    [store, persistYear],
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
      persistYear(year, { items })
    },
    [store, persistYear],
  )

  const addItem = useCallback(
    (year: number, label: string, owner: TaxDocOwner, category: ChecklistCategory, accountIds: number[] = []) => {
      const yr = store.years[year] ?? getEmptyYear()
      const item: TaxChecklistItem = { id: nextId(), label, owner, category, accountIds, files: [] }
      persistYear(year, { ...yr, items: [...yr.items, item] })
      return item
    },
    [store, persistYear],
  )

  const removeItem = useCallback(
    (year: number, itemId: string) => {
      const yr = store.years[year]
      if (!yr) return
      persistYear(year, { ...yr, items: yr.items.filter(i => i.id !== itemId) })
    },
    [store, persistYear],
  )

  const updateItem = useCallback(
    (year: number, itemId: string, updates: Partial<Pick<TaxChecklistItem, 'label' | 'owner' | 'accountIds'>>) => {
      const yr = store.years[year]
      if (!yr) return
      persistYear(year, { ...yr, items: yr.items.map(i => (i.id === itemId ? { ...i, ...updates } : i)) })
    },
    [store, persistYear],
  )

  /** Writes the document bytes into `taxes/{year}/files/` and records the metadata. */
  const addFileToItemAsync = useCallback(
    async (year: number, itemId: string, file: TaxDocFile, content?: ArrayBuffer) => {
      const yr = store.years[year]
      if (!yr) return
      let storedName = file.storedName
      if (content) {
        storedName = await uniqueTaxFileName(fileStore, year, file.name)
        await fileStore.writeBinary(taxFilePath(year, storedName), content)
      }
      const metadataFile: TaxDocFile = { ...file, content: undefined, storedName }
      persistYear(year, {
        ...yr,
        items: yr.items.map(i => (i.id === itemId ? { ...i, files: [...i.files, metadataFile] } : i)),
      })
    },
    [store, persistYear, fileStore],
  )

  /** Reads a stored document back as raw bytes. */
  const getFileContent = useCallback(
    (year: number, file: TaxDocFile): Promise<ArrayBuffer | null> =>
      fileStore.readBinary(taxFilePath(year, file.storedName || file.name)),
    [fileStore],
  )

  const removeFileFromItem = useCallback(
    (year: number, itemId: string, fileId: string) => {
      const yr = store.years[year]
      if (!yr) return
      const target = yr.items.find(i => i.id === itemId)?.files.find(f => f.id === fileId)
      persistYear(year, {
        ...yr,
        items: yr.items.map(i => (i.id === itemId ? { ...i, files: i.files.filter(f => f.id !== fileId) } : i)),
      })
      if (target) {
        fileStore.delete(taxFilePath(year, target.storedName || target.name)).catch(() => {})
      }
    },
    [store, persistYear, fileStore],
  )

  const allYears = useMemo(
    () =>
      Object.keys(store.years)
        .map(Number)
        .sort((a, b) => b - a),
    [store],
  )

  /* ── Template operations ──────────────────────────────────── */

  const persistTemplates = useCallback(
    (next: TaxTemplate[]) => {
      setTemplates(next)
      saveTemplates(fileStore, next).catch(console.error)
    },
    [fileStore],
  )

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
      persistYear(year, { items })
    },
    [store, persistYear],
  )

  const deleteYear = useCallback(
    (year: number) => {
      const yearData = store.years[year]
      setStore(prev => {
        const { [year]: _removed, ...rest } = prev.years
        return { ...prev, years: rest }
      })
      deleteTaxYear(fileStore, year, yearData).catch(console.error)
      window.dispatchEvent(new Event('tax-store-changed'))
    },
    [store, fileStore],
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
    addFileToItemAsync,
    getFileContent,
    removeFileFromItem,
    templates,
    saveAsTemplate,
    updateTemplate,
    deleteTemplate,
    createYearFromTemplate,
    deleteYear,
  }
}
