import { FC, useState, useEffect } from 'react';
import { NavigationProps, FinancialPlan } from '../types';
import SidebarToggle from './SidebarToggle';
import SettingsMenu from './SettingsMenu';
import '../styles/SidebarNavigation.css';

interface SidebarNavigationProps extends NavigationProps {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  plans: FinancialPlan[];
  selectedNavPlanId: number | null;
  onSelectNavPlan: (id: number) => void;
}

const SidebarNavigation: FC<SidebarNavigationProps> = ({ currentPage, setCurrentPage, expanded, setExpanded, darkMode, setDarkMode, plans, selectedNavPlanId, onSelectNavPlan }) => {
  const [plansOpen, setPlansOpen] = useState(() => currentPage === 'plan');

  useEffect(() => {
    if (currentPage === 'plan') setPlansOpen(true);
  }, [currentPage]);

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
              className={`sidebar-link sidebar-link--accordion${currentPage === 'plan' && selectedNavPlanId === null ? ' active' : ''}`}
              onClick={() => {
                setCurrentPage('plan');
                setPlansOpen(open => !open);
              }}
              aria-label="Plan"
            >
              <span>Plan</span>
              <span className={`sidebar-chevron${plansOpen ? ' open' : ''}`}>▾</span>
            </button>
            {plansOpen && plans.length > 0 && (
              <ul className="sidebar-submenu">
                {plans.map(plan => (
                  <li key={plan.id} className="sidebar-subitem">
                    <button
                      className={`sidebar-sublink${selectedNavPlanId === plan.id && currentPage === 'plan' ? ' active' : ''}`}
                      onClick={() => onSelectNavPlan(plan.id)}
                    >
                      {plan.planName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
