import { FC } from 'react';
import { NavigationProps } from '../types';
import SidebarToggle from './SidebarToggle';
import SettingsMenu from './SettingsMenu';
import '../styles/SidebarNavigation.css';

interface SidebarNavigationProps extends NavigationProps {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

const SidebarNavigation: FC<SidebarNavigationProps> = ({ currentPage, setCurrentPage, expanded, setExpanded, darkMode, setDarkMode }) => {
  return (
    <nav className={`sidebar${expanded ? '' : ' collapsed'}`}>  
      <SidebarToggle expanded={expanded} onToggle={() => setExpanded(false)} />
      {expanded && <div className="sidebar-logo">Finance Tracker</div>}
      {expanded && (
        <ul className="sidebar-menu">
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'home' ? ' active' : ''}`}
              onClick={() => setCurrentPage('home')}
              aria-label="Home"
            >
              Home
            </button>
          </li>
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'plan' ? ' active' : ''}`}
              onClick={() => setCurrentPage('plan')}
              aria-label="Plan"
            >
              Plan
            </button>
          </li>
        </ul>
      )}
      {expanded && (
        <div className="sidebar-settings-section">
          <SettingsMenu darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />
        </div>
      )}
    </nav>
  );
};

export default SidebarNavigation;
