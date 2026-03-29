import { FC, ReactNode } from 'react'

export type PageType = 'home' | 'plan'

export interface FinancialPlan {
  id: number
  planName?: string
  description?: string
  createdAt: string
  [key: string]: string | number | undefined
}

export interface NavigationProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export type PageRenderer = {
  [key in PageType]: FC<any>
}
