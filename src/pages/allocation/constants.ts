import { AssetAllocation } from '../data/types'
import { RatioPreset } from './types'

export const ALLOC_COLORS: Record<AssetAllocation, string> = {
  cash: '#6b7280',
  'us-stock': '#6366f1',
  'intl-stock': '#8b5cf6',
  bonds: '#0ea5e9',
  'real-estate': '#f59e0b',
  others: '#84cc16',
  debt: '#ef4444',
}

export const ALL_CLASSES: AssetAllocation[] = ['us-stock', 'intl-stock', 'bonds', 'cash', 'real-estate', 'others', 'debt']

export const PRESETS: RatioPreset[] = [
  {
    id: 'stock-bond-fi',
    name: 'Stock vs Bond',
    scope: 'fi',
    groups: [
      { label: 'Stocks', classes: ['us-stock', 'intl-stock'], color: '#6366f1' },
      { label: 'Bonds', classes: ['bonds'], color: '#0ea5e9' },
    ],
  },
  {
    id: 'us-intl-total',
    name: 'US vs International',
    scope: 'total',
    groups: [
      { label: 'US Stock', classes: ['us-stock'], color: '#6366f1' },
      { label: 'Intl Stock', classes: ['intl-stock'], color: '#8b5cf6' },
    ],
  },
  {
    id: 'equity-fixed-total',
    name: 'Equity vs Fixed Income',
    scope: 'total',
    groups: [
      { label: 'Equity', classes: ['us-stock', 'intl-stock'], color: '#6366f1' },
      { label: 'Fixed Income', classes: ['bonds', 'cash'], color: '#0ea5e9' },
    ],
  },
  {
    id: 'growth-defensive-total',
    name: 'Growth vs Defensive',
    scope: 'total',
    groups: [
      { label: 'Growth', classes: ['us-stock', 'intl-stock', 'real-estate'], color: '#6366f1' },
      { label: 'Defensive', classes: ['bonds', 'cash'], color: '#0ea5e9' },
    ],
  },
]

export const GROUP_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#84cc16']

export const STORAGE_KEY = 'allocation-custom-ratios'
