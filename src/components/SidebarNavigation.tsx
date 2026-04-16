import { FC, useState, useRef, useEffect } from 'react';
import { FinancialGoal, NavigationProps } from '../types';
import { Profile } from '../hooks/useProfile';
import { GitHubSyncConfig, SyncStatus, CommitEntry, ConnectionTestResult, RestoreResult } from '../hooks/useGitHubSync';
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
  homeTheme?: string;
  onHomeThemeChange?: (theme: string) => void;
  goals: FinancialGoal[];
  selectedNavGoalIds: number[];
  isMultiSelectMode: boolean;
  onSelectNavGoal: (goalId: number, multi: boolean) => void;
  onExitMultiSelect: () => void;
  onRenameGoal: (goalId: number, name: string) => void;
  onDeleteGoal: (goalId: number) => void;
  onDeleteMultiple: (ids: number[]) => void;
  onReorderGoals: (orderedIds: number[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  profile: Profile;
  onUpdateProfile: (updates: Partial<Profile>) => void;
  hasPendingGitHubChanges?: boolean;
  ghConfig?: GitHubSyncConfig;
  ghIsConfigured?: boolean;
  ghSyncStatus?: SyncStatus;
  ghLastSyncAt?: string | null;
  ghLastError?: string | null;
  ghHistory?: CommitEntry[];
  ghHasStoredToken?: boolean;
  ghTokenUnlocked?: boolean;
  ghUsingLegacyToken?: boolean;
  onGhUpdateConfig?: (updates: Partial<GitHubSyncConfig>) => void;
  onGhSaveEncryptedToken?: (token: string, passphrase: string) => Promise<{ ok: boolean; message: string }>;
  onGhMigrateLegacyToken?: (passphrase: string) => Promise<{ ok: boolean; message: string }>;
  onGhUnlockToken?: (passphrase: string) => Promise<{ ok: boolean; message: string }>;
  onGhLockToken?: () => void;
  onGhSyncNow?: (data: object, message?: string) => Promise<void>;
  onGhFetchHistory?: () => Promise<void>;
  onGhTestConnection?: () => Promise<ConnectionTestResult>;
  onGhRestoreLatest?: () => Promise<RestoreResult>;
  onGhRestoreFromCommit?: (commitSha: string) => Promise<RestoreResult>;
  ghDataToSync?: object;
  onGhApplyRestore?: (data: unknown) => Promise<void>;
  onFactoryReset?: () => void;
  allowCsvImport?: boolean;
  onToggleAllowCsvImport?: () => void;
}

interface OverflowMenu { goalId: number; x: number; y: number }

const SidebarNavigation: FC<SidebarNavigationProps> = ({
  currentPage, setCurrentPage, expanded, setExpanded,
  darkMode, setDarkMode, fiTheme, onFiThemeChange, gwTheme, onGwThemeChange, homeTheme, onHomeThemeChange,
  goals, selectedNavGoalIds, isMultiSelectMode, onSelectNavGoal, onExitMultiSelect,
  onRenameGoal, onDeleteGoal, onDeleteMultiple, onReorderGoals, onExport, onImport,
  profile, onUpdateProfile, hasPendingGitHubChanges = false,
  ghConfig, ghIsConfigured = false, ghSyncStatus, ghLastSyncAt, ghLastError, ghHistory = [],
  ghHasStoredToken, ghTokenUnlocked, ghUsingLegacyToken,
  onGhUpdateConfig, onGhSaveEncryptedToken, onGhMigrateLegacyToken, onGhUnlockToken, onGhLockToken,
  onGhSyncNow, onGhFetchHistory, onGhTestConnection, onGhRestoreLatest, onGhRestoreFromCommit,
  ghDataToSync, onGhApplyRestore,
  onFactoryReset = () => {},
  allowCsvImport = false,
  onToggleAllowCsvImport = () => {},
}) => {
  const [goalAccordionOpen, setGoalAccordionOpen] = useState(true);
  const [overflowMenu, setOverflowMenu] = useState<OverflowMenu | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after'>('after');
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const openOverflow = (e: React.MouseEvent, goalId: number) => {
    e.stopPropagation();
    e.preventDefault();
    const menuW = 150, menuH = 130;
    const x = e.clientX + menuW > window.innerWidth ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > window.innerHeight ? e.clientY - menuH : e.clientY;
    setOverflowMenu({ goalId, x, y });
  };

  const startRename = (goalId: number, name: string) => {
    setOverflowMenu(null);
    setRenamingId(goalId);
    setRenameValue(name);
  };

  const commitRename = (goalId: number) => {
    if (renameValue.trim()) onRenameGoal(goalId, renameValue.trim());
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
    const ids = goals.map(p => p.id);
    const without = ids.filter(id => id !== draggedId);
    const targetIdx = without.indexOf(targetId);
    const insertIdx = dragOverSide === 'before' ? targetIdx : targetIdx + 1;
    without.splice(insertIdx, 0, draggedId);
    onReorderGoals(without);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  const isGoalActive = currentPage === 'goal' || currentPage === 'goal-solo';

  return (
    <nav className={`sidebar${expanded ? '' : ' collapsed'}`}>
      <div className="sidebar-top-row">
        <SidebarToggle expanded={expanded} onToggle={() => setExpanded(false)} />
        {expanded && <div className="sidebar-logo">Finance Tracker</div>}
      </div>
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
              className={`sidebar-link sidebar-link--accordion${isGoalActive ? ' active' : ''}`}
              onClick={() => {
                setCurrentPage('goal');
                setGoalAccordionOpen(o => !o);
              }}
            >
              Goals
              <span className="sidebar-chevron" style={{ transform: goalAccordionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
            {goalAccordionOpen && (
              <>
                {isMultiSelectMode && selectedNavGoalIds.length > 0 && (
                  <div className="sidebar-multiselect-bar">
                    <span className="sidebar-multiselect-count">{selectedNavGoalIds.length} selected</span>
                    <div className="sidebar-multiselect-actions">
                      <button className="sidebar-multiselect-btn sidebar-multiselect-btn--danger"
                        onClick={() => { onDeleteMultiple(selectedNavGoalIds); onExitMultiSelect(); }}>
                        Delete
                      </button>
                      <button className="sidebar-multiselect-btn sidebar-multiselect-btn--close" onClick={onExitMultiSelect}>✕</button>
                    </div>
                  </div>
                )}
                <ul className="sidebar-submenu">
                  {goals.map(goal => {
                    let cls = 'sidebar-subitem';
                    if (draggedId === goal.id) cls += ' sidebar-subitem--dragging';
                    else if (dragOverId === goal.id) cls += ` sidebar-subitem--drag-${dragOverSide}`;
                    const isSelected = selectedNavGoalIds.includes(goal.id);
                    return (
                      <li
                        key={goal.id}
                        className={cls}
                        draggable={renamingId !== goal.id}
                        onDragStart={renamingId !== goal.id ? e => handleDragStart(e, goal.id) : undefined}
                        onDragOver={e => handleDragOver(e, goal.id)}
                        onDrop={e => handleDrop(e, goal.id)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={e => openOverflow(e, goal.id)}
                      >
                        {renamingId === goal.id ? (
                          <input
                            ref={renameInputRef}
                            className="sidebar-rename-input"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(goal.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(goal.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                          />
                        ) : (
                          <div className={`sidebar-subitem-row${overflowMenu?.goalId === goal.id ? ' menu-open' : ''}`}>
                            {isMultiSelectMode && (
                              <span className="sidebar-checkbox" style={{ paddingLeft: '0.5rem' }}>
                                <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }}
                                  onClick={e => { e.stopPropagation(); onSelectNavGoal(goal.id, true); }} />
                              </span>
                            )}
                            <button
                              className={`sidebar-sublink${isSelected ? ' active' : ''}`}
                              onClick={e => onSelectNavGoal(goal.id, e.metaKey || e.ctrlKey)}
                              title={goal.goalName}
                            >
                              <span className="sidebar-sublink-name">{goal.goalName}</span>
                            </button>
                            <button
                              className="sidebar-overflow-btn"
                              title="More options"
                              onClick={e => openOverflow(e, goal.id)}
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
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'data' ? ' active' : ''}`}
              onClick={() => setCurrentPage('data')}
            >
              Data
            </button>
          </li>
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'budget' ? ' active' : ''}`}
              onClick={() => setCurrentPage('budget')}
            >
              Budget
            </button>
          </li>
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'tools' ? ' active' : ''}`}
              onClick={() => setCurrentPage('tools')}
            >
              Tools
            </button>
          </li>
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'drive' ? ' active' : ''}`}
              onClick={() => setCurrentPage('drive')}
            >
              Drive
            </button>
          </li>
        </ul>
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
            homeTheme={homeTheme}
            onHomeThemeChange={onHomeThemeChange}
            hasPendingChanges={hasPendingGitHubChanges}
            ghConfig={ghConfig}
            ghIsConfigured={ghIsConfigured}
            ghSyncStatus={ghSyncStatus}
            ghLastSyncAt={ghLastSyncAt}
            ghLastError={ghLastError}
            ghHistory={ghHistory}
            ghHasStoredToken={ghHasStoredToken}
            ghTokenUnlocked={ghTokenUnlocked}
            ghUsingLegacyToken={ghUsingLegacyToken}
            onGhUpdateConfig={onGhUpdateConfig}
            onGhSaveEncryptedToken={onGhSaveEncryptedToken}
            onGhMigrateLegacyToken={onGhMigrateLegacyToken}
            onGhUnlockToken={onGhUnlockToken}
            onGhLockToken={onGhLockToken}
            onGhSyncNow={onGhSyncNow}
            onGhFetchHistory={onGhFetchHistory}
            onGhTestConnection={onGhTestConnection}
            onGhRestoreLatest={onGhRestoreLatest}
            onGhRestoreFromCommit={onGhRestoreFromCommit}
            ghData={ghDataToSync}
            onGhApplyRestore={onGhApplyRestore}
            onFactoryReset={onFactoryReset}
            allowCsvImport={allowCsvImport}
            onToggleAllowCsvImport={onToggleAllowCsvImport}
            onExport={onExport}
            onImport={onImport}
          />
        </div>
      )}
      {overflowMenu && (() => {
        const goal = goals.find(p => p.id === overflowMenu.goalId);
        if (!goal) return null;
        return (
          <>
            <div className="sidebar-menu-overlay" onClick={() => setOverflowMenu(null)} />
            <div
              ref={overflowMenuRef}
              className="sidebar-overflow-menu"
              style={{ top: overflowMenu.y, left: overflowMenu.x }}
            >
              <button className="sidebar-overflow-menu-item" onClick={() => { setOverflowMenu(null); onSelectNavGoal(goal.id, false); }}>Open</button>
              <button className="sidebar-overflow-menu-item" onClick={() => startRename(goal.id, goal.goalName)}>Rename</button>
              <button className="sidebar-overflow-menu-item sidebar-overflow-menu-item--danger" onClick={() => { setOverflowMenu(null); onDeleteGoal(goal.id); }}>Delete</button>
            </div>
          </>
        );
      })()}
    </nav>
  );
};

export default SidebarNavigation;
