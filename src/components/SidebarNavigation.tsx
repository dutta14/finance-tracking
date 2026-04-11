import { FC, useState, useRef, useEffect } from 'react';
import { FinancialPlan, NavigationProps } from '../types';
import { Profile } from '../hooks/useProfile';
import SidebarToggle from './SidebarToggle';
import SettingsMenu from './SettingsMenu';
import '../styles/SidebarNavigation.css';

interface SidebarNavigationProps extends NavigationProps {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  fiTheme?: string;
  onFiThemeChange?: (theme: string) => void;
  gwTheme?: string;
  onGwThemeChange?: (theme: string) => void;
  plans: FinancialPlan[];
  selectedNavPlanIds: number[];
  isMultiSelectMode: boolean;
  onSelectNavPlan: (planId: number, multi: boolean) => void;
  onExitMultiSelect: () => void;
  onRenamePlan: (planId: number, name: string) => void;
  onDeletePlan: (planId: number) => void;
  onDeleteMultiple: (ids: number[]) => void;
  onReorderPlans: (orderedIds: number[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  profile: Profile;
  onUpdateProfile: (updates: Partial<Profile>) => void;
}

interface OverflowMenu { planId: number; x: number; y: number }

const SidebarNavigation: FC<SidebarNavigationProps> = ({
  currentPage, setCurrentPage, expanded, setExpanded,
  darkMode, setDarkMode, fiTheme, onFiThemeChange, gwTheme, onGwThemeChange,
  plans, selectedNavPlanIds, isMultiSelectMode, onSelectNavPlan, onExitMultiSelect,
  onRenamePlan, onDeletePlan, onDeleteMultiple, onReorderPlans,
  onExport, onImport, profile, onUpdateProfile,
}) => {
  const [planAccordionOpen, setPlanAccordionOpen] = useState(true);
  const [overflowMenu, setOverflowMenu] = useState<OverflowMenu | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after'>('after');
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!overflowMenu) return;
    const handler = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setOverflowMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowMenu]);

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus();
  }, [renamingId]);

  const openOverflow = (e: React.MouseEvent, planId: number) => {
    e.stopPropagation();
    const menuW = 150, menuH = 130;
    const x = e.clientX + menuW > window.innerWidth ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > window.innerHeight ? e.clientY - menuH : e.clientY;
    setOverflowMenu({ planId, x, y });
  };

  const startRename = (planId: number, name: string) => {
    setOverflowMenu(null);
    setRenamingId(planId);
    setRenameValue(name);
  };

  const commitRename = (planId: number) => {
    if (renameValue.trim()) onRenamePlan(planId, renameValue.trim());
    setRenamingId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    e.preventDefault();
    if (id === draggedId) { setDragOverId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverId(id);
    setDragOverSide(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;
    const ids = plans.map(p => p.id);
    const without = ids.filter(id => id !== draggedId);
    const targetIdx = without.indexOf(targetId);
    const insertIdx = dragOverSide === 'before' ? targetIdx : targetIdx + 1;
    without.splice(insertIdx, 0, draggedId);
    onReorderPlans(without);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  const isPlanActive = currentPage === 'plan' || currentPage === 'plan-solo';

  return (
    <nav className={`sidebar${expanded ? '' : ' collapsed'}`}>
      <div className="sidebar-toggle">
        <SidebarToggle expanded={expanded} onToggle={() => setExpanded(false)} />
      </div>
      {expanded && <div className="sidebar-logo">Finance Tracker</div>}
      {expanded && (
        <ul className="sidebar-menu">
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'home' ? ' active' : ''}`}
              onClick={() => setCurrentPage('home')}
            >
              Home
            </button>
          </li>
          <li className="sidebar-item">
            <button
              className={`sidebar-link sidebar-link--accordion${isPlanActive ? ' active' : ''}`}
              onClick={() => {
                setCurrentPage('plan');
                setPlanAccordionOpen(o => !o);
              }}
            >
              Plans
              <span className="sidebar-chevron" style={{ transform: planAccordionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
            {planAccordionOpen && (
              <>
                {isMultiSelectMode && selectedNavPlanIds.length > 0 && (
                  <div className="sidebar-multiselect-bar">
                    <span className="sidebar-multiselect-count">{selectedNavPlanIds.length} selected</span>
                    <div className="sidebar-multiselect-actions">
                      <button className="sidebar-multiselect-btn sidebar-multiselect-btn--danger"
                        onClick={() => { onDeleteMultiple(selectedNavPlanIds); onExitMultiSelect(); }}>
                        Delete
                      </button>
                      <button className="sidebar-multiselect-btn sidebar-multiselect-btn--close" onClick={onExitMultiSelect}>✕</button>
                    </div>
                  </div>
                )}
                <ul className="sidebar-submenu">
                  {plans.map(plan => {
                    let cls = 'sidebar-subitem';
                    if (draggedId === plan.id) cls += ' sidebar-subitem--dragging';
                    else if (dragOverId === plan.id) cls += ` sidebar-subitem--drag-${dragOverSide}`;
                    const isSelected = selectedNavPlanIds.includes(plan.id);
                    return (
                      <li
                        key={plan.id}
                        className={cls}
                        draggable={renamingId !== plan.id}
                        onDragStart={renamingId !== plan.id ? e => handleDragStart(e, plan.id) : undefined}
                        onDragOver={e => handleDragOver(e, plan.id)}
                        onDrop={e => handleDrop(e, plan.id)}
                        onDragEnd={handleDragEnd}
                      >
                        {renamingId === plan.id ? (
                          <input
                            ref={renameInputRef}
                            className="sidebar-rename-input"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(plan.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(plan.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                          />
                        ) : (
                          <div className={`sidebar-subitem-row${overflowMenu?.planId === plan.id ? ' menu-open' : ''}`}>
                            {isMultiSelectMode && (
                              <span className="sidebar-checkbox" style={{ paddingLeft: '0.5rem' }}>
                                <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }}
                                  onClick={e => { e.stopPropagation(); onSelectNavPlan(plan.id, true); }} />
                              </span>
                            )}
                            <button
                              className={`sidebar-sublink${isSelected ? ' active' : ''}`}
                              onClick={e => onSelectNavPlan(plan.id, e.metaKey || e.ctrlKey)}
                              title={plan.planName}
                            >
                              <span className="sidebar-sublink-name">{plan.planName}</span>
                            </button>
                            <button
                              className="sidebar-overflow-btn"
                              title="More options"
                              onClick={e => openOverflow(e, plan.id)}
                              aria-label="More options"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                <circle cx="7" cy="2.5" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </li>
        </ul>
      )}
      {expanded && (
        <div className="sidebar-data-section">
          <button className="sidebar-data-btn" onClick={onExport} title="Export plans">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 1v7M3.5 5l3 3 3-3M1.5 9.5v1a1 1 0 001 1h8a1 1 0 001-1v-1"/>
            </svg>
            Export
          </button>
          <button className="sidebar-data-btn" onClick={() => importInputRef.current?.click()} title="Import plans">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 9V2M3.5 5l3-3 3 3M1.5 9.5v1a1 1 0 001 1h8a1 1 0 001-1v-1"/>
            </svg>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) { onImport(file); e.target.value = ''; }
            }}
          />
        </div>
      )}
      {expanded && (
        <div className="sidebar-settings-section">
          <SettingsMenu
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            fiTheme={fiTheme}
            onFiThemeChange={onFiThemeChange}
            gwTheme={gwTheme}
            onGwThemeChange={onGwThemeChange}
          />
        </div>
      )}
      {overflowMenu && (() => {
        const plan = plans.find(p => p.id === overflowMenu.planId);
        if (!plan) return null;
        return (
          <>
            <div className="sidebar-menu-overlay" onClick={() => setOverflowMenu(null)} />
            <div
              ref={overflowMenuRef}
              className="sidebar-overflow-menu"
              style={{ top: overflowMenu.y, left: overflowMenu.x }}
            >
              <button className="sidebar-overflow-menu-item" onClick={() => { setOverflowMenu(null); onSelectNavPlan(plan.id, false); }}>Open</button>
              <button className="sidebar-overflow-menu-item" onClick={() => startRename(plan.id, plan.planName)}>Rename</button>
              <button className="sidebar-overflow-menu-item sidebar-overflow-menu-item--danger" onClick={() => { setOverflowMenu(null); onDeletePlan(plan.id); }}>Delete</button>
            </div>
          </>
        );
      })()}
    </nav>
  );
};

export default SidebarNavigation;
