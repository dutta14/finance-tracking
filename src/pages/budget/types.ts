/** A single row from a CSV file */
export interface Transaction {
  date: string      // ISO date string (yyyy-mm-dd)
  category: string  // Category name
  amount: number    // Positive = income, negative = expense
  description?: string
}

/** Raw CSV stored per month */
export interface MonthCSV {
  /** Key like "2025-05" */
  month: string
  /** Raw CSV text */
  csv: string
  /** When it was uploaded */
  uploadedAt: string
}

/** Parsed transactions for a month */
export interface MonthData {
  month: string         // "2025-05"
  transactions: Transaction[]
}

/** Parent category grouping */
export interface CategoryGroup {
  id: string
  name: string
  /** Ordered list of category names in this group */
  categories: string[]
}

/** Persisted budget configuration per year (legacy — migrated to global) */
export interface BudgetConfig {
  year: number
  categoryGroups: CategoryGroup[]
}

/** Budget config synced to GitHub as JSON */
export interface BudgetConfigData {
  version: number
  years: number[]
  categoryGroups: CategoryGroup[]
}

/** All budget data stored in localStorage */
export interface BudgetStore {
  /** Raw CSVs keyed by "yyyy-mm" */
  csvs: Record<string, MonthCSV>
  /** Legacy per-year configs (migrated to global categoryGroups) */
  configs: Record<number, BudgetConfig>
  /** Set of years that have been created */
  years: number[]
  /** Global category groups shared across all years */
  categoryGroups?: CategoryGroup[]
}

export type BudgetViewMode = 'detailed' | 'aggregated'
export type TimePeriod = 'month' | 'quarter' | 'half'
