import { FC, useState, useRef, useEffect } from 'react'
import { Profile } from '../../hooks/useProfile'
import {
  Account, AccountType, AccountOwner, AccountGoalType, AccountStatus, AccountNature, AssetAllocation,
  ACCOUNT_TYPE_LABELS, NATURE_LABELS, ALLOCATION_LABELS, getTypesForGoal, getDefaultType, getDefaultAllocation, getOwnerLabels,
} from './types'

interface AccountFormProps {
  profile: Profile
  initial?: Account
  existingGroups?: string[]
  onSave: (data: Omit<Account, 'id'>) => void
  onCancel: () => void
}

const AccountForm: FC<AccountFormProps> = ({ profile, initial, existingGroups = [], onSave, onCancel }) => {
  const hasPartner = !!profile.partner
  const ownerLabels = getOwnerLabels(profile)
  const [name, setName] = useState(initial?.name || '')
  const [goalType, setGoalType] = useState<AccountGoalType>(initial?.goalType || 'fi')
  const [type, setType] = useState<AccountType>(initial?.type || getDefaultType(initial?.goalType || 'fi'))
  const [owner, setOwner] = useState<AccountOwner>(initial?.owner || 'primary')
  const [status, setStatus] = useState<AccountStatus>(initial?.status || 'active')
  const [nature, setNature] = useState<AccountNature>(initial?.nature || 'asset')
  const [allocation, setAllocation] = useState<AssetAllocation>(initial?.allocation || getDefaultAllocation(initial?.nature || 'asset'))
  const [group, setGroup] = useState(initial?.group || '')
  const [institution, setInstitution] = useState(initial?.institution || '')
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setShowGroupDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), type, owner, goalType, status, nature, allocation, group: group.trim() || undefined, institution: institution.trim() || undefined })
  }

  return (
    <form className="data-form" onSubmit={handleSubmit}>
      <div className="data-form-row">
        <div className="data-form-field">
          <label>Account Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chase Checking" autoFocus />
        </div>
        <div className="data-form-field">
          <label>Institution</label>
          <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. Chase" />
        </div>
        <div className="data-form-field" ref={groupRef}>
          <label>Group</label>
          <div className="data-group-input-wrap">
            <input
              type="text"
              className="data-group-input"
              value={group}
              onChange={e => { setGroup(e.target.value); setShowGroupDropdown(true) }}
              onFocus={() => existingGroups.length > 0 && setShowGroupDropdown(true)}
              placeholder="Optional group name"
            />
            {existingGroups.length > 0 && (
              <button type="button" className="data-group-chevron" onClick={() => setShowGroupDropdown(v => !v)} tabIndex={-1}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            {showGroupDropdown && existingGroups.length > 0 && (
              <ul className="data-group-dropdown">
                {existingGroups
                  .filter(g => !group || g.toLowerCase().includes(group.toLowerCase()))
                  .map(g => (
                    <li key={g} className={`data-group-option${g === group ? ' selected' : ''}`}
                      onMouseDown={() => { setGroup(g); setShowGroupDropdown(false) }}>{g}</li>
                  ))}
                {group && !existingGroups.includes(group) && (
                  <li className="data-group-option data-group-new" onMouseDown={() => setShowGroupDropdown(false)}>
                    Create "{group}"
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="data-form-row">
        <div className="data-form-field">
          <label>Goal Allocation</label>
          <select value={goalType} onChange={e => {
            const g = e.target.value as AccountGoalType
            setGoalType(g)
            setType(getDefaultType(g))
          }}>
            <option value="fi">FI</option>
            <option value="gw">GW</option>
          </select>
        </div>
        <div className="data-form-field">
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value as AccountType)}>
            {getTypesForGoal(goalType).map(t => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="data-form-field">
          <label>Owner</label>
          <select value={owner} onChange={e => setOwner(e.target.value as AccountOwner)}>
            <option value="primary">{ownerLabels.primary}</option>
            {hasPartner && <option value="partner">{ownerLabels.partner}</option>}
            <option value="joint">{ownerLabels.joint}</option>
          </select>
        </div>
        <div className="data-form-field">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as AccountStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="data-form-field">
          <label>Asset / Liability</label>
          <select value={nature} onChange={e => {
            const n = e.target.value as AccountNature
            setNature(n)
            setAllocation(getDefaultAllocation(n))
          }}>
            {Object.entries(NATURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="data-form-field">
          <label>Asset Allocation</label>
          <select value={allocation} onChange={e => setAllocation(e.target.value as AssetAllocation)}>
            {Object.entries(ALLOCATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="data-form-actions">
        <button type="submit" className="data-form-save">{initial ? 'Update' : 'Add Account'}</button>
        <button type="button" className="data-form-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default AccountForm
