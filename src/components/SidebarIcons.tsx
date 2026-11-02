import { FC, ReactNode } from 'react'

const SidebarIcon: FC<{ children: ReactNode }> = ({ children }) => (
  <svg
    className="sidebar-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

export const HomeIcon: FC = () => (
  <SidebarIcon>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
  </SidebarIcon>
)

export const SearchIcon: FC = () => (
  <SidebarIcon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4.2-4.2" />
  </SidebarIcon>
)

export const GoalsIcon: FC = () => (
  <SidebarIcon>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </SidebarIcon>
)

export const NetWorthIcon: FC = () => (
  <SidebarIcon>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </SidebarIcon>
)

export const BudgetIcon: FC = () => (
  <SidebarIcon>
    <path d="M21 12a9 9 0 1 1-9-9" />
    <path d="M12 3a9 9 0 0 1 9 9h-9z" />
  </SidebarIcon>
)

export const TransactionsIcon: FC = () => (
  <SidebarIcon>
    <path d="M4 8h15" />
    <path d="m15 4 4 4-4 4" />
    <path d="M20 16H5" />
    <path d="m9 12-4 4 4 4" />
  </SidebarIcon>
)

export const TaxesIcon: FC = () => (
  <SidebarIcon>
    <path d="M19 5 5 19" />
    <circle cx="7" cy="7" r="2.2" />
    <circle cx="17" cy="17" r="2.2" />
  </SidebarIcon>
)

export const DriveIcon: FC = () => (
  <SidebarIcon>
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="m5 13 2.5-8h9L19 13" />
    <path d="M7 16.5h.01" />
  </SidebarIcon>
)

export const SettingsIcon: FC = () => (
  <SidebarIcon>
    <path d="M4 7h9" />
    <path d="M17 7h3" />
    <circle cx="15" cy="7" r="2" />
    <path d="M4 17h3" />
    <path d="M11 17h9" />
    <circle cx="9" cy="17" r="2" />
  </SidebarIcon>
)

export const GuideIcon: FC = () => (
  <SidebarIcon>
    <path d="M12 6.5C10.5 5.3 8 4.5 4 4.5V18c4 0 6.5.8 8 2 1.5-1.2 4-2 8-2V4.5c-4 0-6.5.8-8 2z" />
    <path d="M12 6.5V20" />
  </SidebarIcon>
)
