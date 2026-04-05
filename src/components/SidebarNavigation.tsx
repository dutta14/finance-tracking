import { FC, useState, useEffect, useRef } from 'react';
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
  onRenamePlan: (id: number, newName: string) => void;
  onDeletePlan: (id: number) => void;
}

interface ContextMenuState { x: number; y: number; planId: number }

const SidebarNavigation: FC<SidebarNavigationProps> = ({
  currentPage, setCurrentPage, expanded, setExpanded,
  darkMode, setDarkMode, plans, selectedNavPlanId, onSelectNavPlan,
  onRenamePlan, onDeletePlan,
}) => {
  const [plansOpen, setPlansOpen] = useState(() => currentPage === 'plan');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPlanId, setRenamingPlanId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentPage === 'plan') setPlansOpen(true);
  }, [currentPage]);

  useEffect(() => {
    if (renamingPlanId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingPlanId]);

  const openContextMenu = (planId: number, x: number, y: number) => setContextMenu({ planId, x, y });
  const closeContextMenu = () => setContextMenu(null);

  const handleRenameStart = () => {
    if (!contextMenu) return;
    const plan = plans.find(p => p.id === contextMenu.planId);
    if (plan) { setRenamingPlanId(plan.id); setRenameValue(plan.planName); }
    closeContextMenu();
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    onDeletePlan(contextMenu.planId);
    closeContextMenu();
  };

  const commitRename = (planId: number) => {
    if (renameValue.trim()) onRenamePlan(planId, renameValue.trim());
    setRenamingPlanId(null);
  };

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
              onClick={() => { setCurrentPage('plan'); setPlansOpen(open => !open); }}
              aria-label="Plan"
            >
              <span>Plan</span>
              <span className={`sidebar-chevron${plansOpen ? ' open' : ''}`}>▾</span>
            </button>
            {plansOpen && plans.length > 0 && (
              <ul className="sidebar-submenu">
                {plans.map(plan => (
                  <li key={plan.id} className="sidebar-subitem">
                    {renamingPlanId === plan.id ? (
                      <input
                        ref={renameInputRef}
                        className="sidebar-rename-input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(plan.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(plan.id);
                          if (e.key === 'Escape') setRenamingPlanId(null);
                        }}
                      />
                    ) : (
                      <div
                        className={`sidebar-subitem-row${contextMenu?.planId === plan.id ? ' menu-open' : ''}`}
                        onContextMenu={e => { e.preventDefault(); openContextMenu(plan.id, e.clientX, e.clientY); }}
                      >
                        <button
                          className={`sidebar-sublink${selectedNavPlanId === plan.id && currentPage === 'plan' ? ' active' : ''}`}
                          onClick={() => onSelectNavPlan(plan.id)}
                        >
                          {plan.planName}
                        </button>
                        <button
                          className="sidebar-overflow-btn"
                          onClick={e => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            openContextMenu(plan.id, rect.left, rect.bottom + 4);
                          }}
                          aria-label="Plan options"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="3" cy="8" r="1.5"/>
                            <circle cx="8" cy="8" r="1.5"/>
                            <circle cx="13" cy="8" r="1.5"/>
                          </svg>
                        </button>
                      </div>
                    )}
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
      {contextMenu && (
        <>
          <div className="sidebar-menu-overlay" onClick={closeContextMenu} />
          <div className="sidebar-overflow-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <button className="sidebar-overflow-menu-item" onClick={handleRenameStart}>Rename</button>
            <button className="sidebar-overflow-menu-item sidebar-overflow-menu-item--danger" onClick={handleDelete}>Delete</button>
          </div>
        </>
      )}
    </nav>
  );
};

export default SidebarNavigation;

