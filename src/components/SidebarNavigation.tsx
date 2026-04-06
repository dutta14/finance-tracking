import { FC, useState, useEffect, useRef } from 'react';
import { NavigationProps, FinancialPlan } from '../types';
import { Profile } from '../hooks/useProfile';
import SidebarToggle from './SidebarToggle';
import SettingsMenu from './SettingsMenu';
import '../styles/SidebarNavigation.css';

interface SidebarNavigationProps extends NavigationProps {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  plans: FinancialPlan[];
  selectedNavPlanIds: number[];
  isMultiSelectMode: boolean;
  onSelectNavPlan: (id: number, multi: boolean) => void;
  onExitMultiSelect: () => void;
  onRenamePlan: (id: number, newName: string) => void;
  onDeletePlan: (id: number) => void;
  onDeleteMultiple: (ids: number[]) => void;
  onReorderPlans: (orderedIds: number[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  profile: Profile;
  onUpdateProfile: (updates: Partial<Profile>) => void;
  onOpenGitHubSync?: () => void;
  hasPendingGitHubChanges?: boolean;
}

interface ContextMenuState { x: number; y: number; planId: number }

const SidebarNavigation: FC<SidebarNavigationProps> = ({
  currentPage, setCurrentPage, expanded, setExpanded,
  darkMode, setDarkMode, plans, selectedNavPlanIds, isMultiSelectMode,
  onSelectNavPlan, onExitMultiSelect,
  onRenamePlan, onDeletePlan, onDeleteMultiple, onReorderPlans, onExport, onImport,
  profile, onUpdateProfile, onOpenGitHubSync, hasPendingGitHubChanges = false,
}) => {
  const [plansOpen, setPlansOpen] = useState(() => {
    const stored = localStorage.getItem('sidebar-plans-open');
    if (stored !== null) return stored === '1';
    return currentPage === 'plan';
  });
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

  const multiSelected = isMultiSelectMode;

  const [draggedPlanId, setDraggedPlanId] = useState<number | null>(null)
  const [dragOverPlanId, setDragOverPlanId] = useState<number | null>(null)
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after'>('after')

  const handleSidebarDragStart = (e: React.DragEvent, id: number) => {
    setDraggedPlanId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleSidebarDragOver = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggedPlanId) { setDragOverPlanId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverSide(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
    setDragOverPlanId(id)
  }

  const handleSidebarDrop = (e: React.DragEvent, targetId: number) => {
    if (draggedPlanId === null || draggedPlanId === targetId) return
    const ids = plans.map(p => p.id)
    const withoutDragged = ids.filter(id => id !== draggedPlanId)
    const targetIdx = withoutDragged.indexOf(targetId)
    const insertIdx = dragOverSide === 'before' ? targetIdx : targetIdx + 1
    withoutDragged.splice(insertIdx, 0, draggedPlanId)
    onReorderPlans(withoutDragged)
    setDraggedPlanId(null)
    setDragOverPlanId(null)
  }

  const handleSidebarDragEnd = () => {
    setDraggedPlanId(null)
    setDragOverPlanId(null)
  }

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
              className={`sidebar-link sidebar-link--accordion${currentPage === 'plan' && selectedNavPlanIds.length === 0 ? ' active' : ''}`}
              onClick={() => {
                setCurrentPage('plan');
                setPlansOpen(open => {
                  localStorage.setItem('sidebar-plans-open', !open ? '1' : '0');
                  return !open;
                });
              }}
              aria-label="Plans"
            >
              <span>Plans</span>
              <svg
                className="sidebar-chevron"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {plansOpen
                  ? <polyline points="2,9 7,4 12,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  : <polyline points="2,5 7,10 12,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                }
              </svg>
            </button>
            {plansOpen && plans.length > 0 && (
              <>
                {multiSelected && (
                  <div className="sidebar-multiselect-bar">
                    <span className="sidebar-multiselect-count">{selectedNavPlanIds.length} selected</span>
                    <div className="sidebar-multiselect-actions">
                      {selectedNavPlanIds.length > 0 && (
                        <button
                          className="sidebar-multiselect-btn sidebar-multiselect-btn--danger"
                          title="Delete selected plans"
                          onClick={() => onDeleteMultiple(selectedNavPlanIds)}
                        >
                          Delete
                        </button>
                      )}
                      <button
                        className="sidebar-multiselect-btn sidebar-multiselect-btn--close"
                        title="Exit selection"
                        aria-label="Exit selection"
                        onClick={onExitMultiSelect}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
                <ul className="sidebar-submenu">
                  {plans.map(plan => {
                    let liClass = 'sidebar-subitem'
                    if (draggedPlanId === plan.id) liClass += ' sidebar-subitem--dragging'
                    else if (dragOverPlanId === plan.id) liClass += ` sidebar-subitem--drag-${dragOverSide}`
                    return (
                    <li key={plan.id} className={liClass}
                      draggable={renamingPlanId !== plan.id}
                      onDragStart={renamingPlanId !== plan.id ? e => handleSidebarDragStart(e, plan.id) : undefined}
                      onDragOver={renamingPlanId !== plan.id ? e => handleSidebarDragOver(e, plan.id) : undefined}
                      onDrop={renamingPlanId !== plan.id ? e => handleSidebarDrop(e, plan.id) : undefined}
                      onDragEnd={handleSidebarDragEnd}
                    >
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
                            className={`sidebar-sublink${multiSelected ? (selectedNavPlanIds.includes(plan.id) ? ' active' : '') : (selectedNavPlanIds.includes(plan.id) && currentPage === 'plan' ? ' active' : '')}`}
                            onClick={e => onSelectNavPlan(plan.id, e.metaKey || e.ctrlKey)}
                          >
                            {multiSelected && (
                              <span className="sidebar-checkbox" aria-hidden="true">
                                {selectedNavPlanIds.includes(plan.id) ? (
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <rect x="0.5" y="0.5" width="13" height="13" rx="3" fill="#4f89e8" stroke="#4f89e8"/>
                                    <polyline points="3,7.5 6,10.5 11,4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <rect x="0.5" y="0.5" width="13" height="13" rx="3" stroke="#9ca3af" strokeWidth="1.2"/>
                                  </svg>
                                )}
                              </span>
                            )}
                            <span className="sidebar-sublink-name">{plan.planName}</span>
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
                    )
                  })}
                </ul>
              </>
            )}
          </li>
        </ul>
      )}
      {expanded && (
        <div className="sidebar-data-section">
          <button className="sidebar-data-btn" onClick={onExport}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
            Export
          </button>
          <label className="sidebar-data-btn sidebar-data-btn--import" title="Import plans from a .json file">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M8 11V2M4 6l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
            Import
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { onImport(file); e.target.value = '' }
              }}
            />
          </label>
        </div>
      )}
      {expanded && (
        <div className="sidebar-settings-section">
          <SettingsMenu
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onOpenGitHubSync={onOpenGitHubSync}
            hasPendingChanges={hasPendingGitHubChanges}
          />
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
