import type { Page } from '@playwright/test'

export async function readJsonFile<T>(page: Page, path: string, fallback: T): Promise<T> {
  return page.evaluate(
    async ({ path, fallback }) => {
      const store = (window as Window & typeof globalThis & { __e2eFileStore?: { readJSON: (path: string, fallback: T) => Promise<T> } }).__e2eFileStore
      if (!store) return fallback
      return store.readJSON(path, fallback)
    },
    { path, fallback },
  )
}

export async function writeJsonFile(page: Page, path: string, data: unknown): Promise<void> {
  await page.evaluate(
    async ({ path, data }) => {
      const store = (window as Window & typeof globalThis & { __e2eFileStore?: { writeJSON: (path: string, data: unknown) => Promise<void> } }).__e2eFileStore
      if (!store) throw new Error(`Missing E2E file store for ${path}`)
      await store.writeJSON(path, data)
    },
    { path, data },
  )
}

export async function readCsvFile(page: Page, path: string): Promise<string[][]> {
  return page.evaluate(async path => {
    const store = (window as Window & typeof globalThis & { __e2eFileStore?: { readCSV: (path: string) => Promise<string[][]> } }).__e2eFileStore
    if (!store) return []
    return store.readCSV(path)
  }, path)
}

export async function writeCsvFile(page: Page, path: string, rows: string[][]): Promise<void> {
  await page.evaluate(
    async ({ path, rows }) => {
      const store = (window as Window & typeof globalThis & { __e2eFileStore?: { writeCSV: (path: string, rows: string[][]) => Promise<void> } }).__e2eFileStore
      if (!store) throw new Error(`Missing E2E file store for ${path}`)
      await store.writeCSV(path, rows)
    },
    { path, rows },
  )
}

export async function deleteFile(page: Page, path: string): Promise<void> {
  await page.evaluate(async path => {
    const store = (window as Window & typeof globalThis & { __e2eFileStore?: { delete: (path: string) => Promise<void> } }).__e2eFileStore
    if (!store) throw new Error(`Missing E2E file store for ${path}`)
    await store.delete(path)
  }, path)
}
