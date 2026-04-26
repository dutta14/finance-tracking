import { FC } from 'react'

interface SidebarToggleProps {
  expanded: boolean
  onToggle: () => void
}

const SidebarToggle: FC<SidebarToggleProps> = ({ expanded, onToggle }) => (
  <button
    className="sidebar-toggle"
    aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
    onClick={onToggle}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '0.25rem',
      outline: 'none',
      fontSize: '1.2rem',
      color: 'var(--sidebar-toggle-color, #000)',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="14" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="4" y="9.4" width="10" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="4" y="13.8" width="14" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  </button>
)

export default SidebarToggle
