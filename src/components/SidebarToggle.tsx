import { FC } from 'react';

interface SidebarToggleProps {
  expanded: boolean;
  onToggle: () => void;
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
      padding: '0.5rem',
      marginBottom: '1rem',
      outline: 'none',
      fontSize: '1.2rem',
      color: '#000',
    }}
  >
    {expanded ? '⟨' : '⟩'}
  </button>
);

export default SidebarToggle;
