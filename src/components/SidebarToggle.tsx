import { FC } from 'react'

interface SidebarToggleProps {
  expanded: boolean
  onToggle: () => void
}

const SidebarToggle: FC<SidebarToggleProps> = ({ expanded, onToggle }) => (
  <button className="sidebar-toggle" aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} onClick={onToggle}>
    <svg
      className="sidebar-toggle-icon sidebar-toggle-icon--hamburger"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="5" width="14" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="4" y="9.4" width="10" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="4" y="13.8" width="14" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
    <svg
      className="sidebar-toggle-icon sidebar-toggle-icon--panel"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="16" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <line x1="8.5" y1="4.5" x2="8.5" y2="17.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  </button>
)

export default SidebarToggle
