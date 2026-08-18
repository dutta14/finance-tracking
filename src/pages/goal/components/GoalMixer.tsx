import { ChangeEvent, FC, useEffect, useMemo, useRef, useState } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { GoalTemplate, GOAL_TEMPLATES } from '../data/goalTemplates'
import { getFiTarget } from '../utils/goalCalculations'
import '../../../styles/GoalMixer.css'

const DEFAULT_SWR = 4

type BaseParams = {
  retirementAge: string
  annualExpense: string
  growth: string
}

type GoalBaseSource = {
  kind: 'goal'
  key: string
  goal: FinancialGoal
}

type TemplateBaseSource = {
  kind: 'template'
  key: string
  template: GoalTemplate
}

type BaseSource = GoalBaseSource | TemplateBaseSource

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()
const fiDisplay = (n: number) => (n > 0 ? dollars(n) : '—')
const goalKey = (id: number) => `goal-${id}`
const templateKey = (id: string) => `template-${id}`
const currentDateValue = () => new Date().toISOString().split('T')[0]
const createdAtLabel = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function computeGwPv(gw: GwGoal, base: FinancialGoal, profileBirthday: string, inflation: number): number {
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(base.goalCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(
    0,
    (disburseYear - created.getUTCFullYear()) * 12 + (birthMonth - (created.getUTCMonth() + 1)),
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + inflation / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - base.retirementAge) * 12)
  return monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
}

function getGoalEndDate(profileBirthday: string): string {
  if (!profileBirthday) return ''
  const [year, month = '01', day = '01'] = profileBirthday.split('-')
  return `${Number(year) + 100}-${month}-${day}`
}

function getRetirementDate(birthday: string, retirementAge: number): string {
  if (!birthday || retirementAge <= 0) return ''
  const [year, month = '01', day = '01'] = birthday.split('-')
  return `${Number(year) + retirementAge}-${month}-${day}`
}

function getBaseParamsFromGoal(goal: FinancialGoal): BaseParams {
  return {
    retirementAge: String(goal.retirementAge),
    annualExpense: String(goal.expenseValue),
    growth: String(goal.growth),
  }
}

function getBaseParamsFromTemplate(template: GoalTemplate): BaseParams {
  return {
    retirementAge: String(template.retirementAge),
    annualExpense: String(template.annualExpense),
    growth: String(template.growth),
  }
}

function parseNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function createSyntheticGoal(
  template: GoalTemplate,
  profileBirthday: string,
  inflation: number,
  params: BaseParams = getBaseParamsFromTemplate(template),
): FinancialGoal | null {
  const retirementAge = parseNumber(params.retirementAge)
  const annualExpense = parseNumber(params.annualExpense)
  const growth = parseNumber(params.growth)

  if (retirementAge === null || retirementAge <= 0 || annualExpense === null || annualExpense <= 0 || growth === null) {
    return null
  }

  const goal: FinancialGoal = {
    id: -1,
    goalName: template.name,
    createdAt: createdAtLabel(),
    birthday: profileBirthday,
    goalCreatedIn: currentDateValue(),
    goalEndYear: getGoalEndDate(profileBirthday),
    resetExpenseMonth: false,
    retirementAge,
    expenseMonth: new Date().getMonth() + 1,
    expenseValue: annualExpense,
    monthlyExpenseValue: annualExpense / 12,
    expenseValueMar2026: annualExpense,
    expenseValue2047: annualExpense,
    monthlyExpenseRetirement: annualExpense / 12,
    safeWithdrawalRate: DEFAULT_SWR,
    growth,
    retirement: getRetirementDate(profileBirthday, retirementAge),
    fiGoal: 0,
    progress: 0,
  }

  return {
    ...goal,
    fiGoal: getFiTarget(goal, profileBirthday, growth, undefined, undefined, inflation),
  }
}

function createGoalVariant(
  goal: FinancialGoal,
  profileBirthday: string,
  inflation: number,
  params: BaseParams,
): FinancialGoal | null {
  const retirementAge = parseNumber(params.retirementAge)
  const annualExpense = parseNumber(params.annualExpense)
  const growth = parseNumber(params.growth)

  if (retirementAge === null || retirementAge <= 0 || annualExpense === null || annualExpense <= 0 || growth === null) {
    return null
  }

  const birthday = goal.birthday || profileBirthday
  const nextGoal: FinancialGoal = {
    ...goal,
    birthday,
    goalCreatedIn: goal.goalCreatedIn || currentDateValue(),
    goalEndYear: goal.goalEndYear || getGoalEndDate(birthday),
    retirementAge,
    expenseValue: annualExpense,
    monthlyExpenseValue: annualExpense / 12,
    monthlyExpenseRetirement: annualExpense / 12,
    safeWithdrawalRate: goal.safeWithdrawalRate || DEFAULT_SWR,
    growth,
    retirement: getRetirementDate(birthday, retirementAge),
  }

  return {
    ...nextGoal,
    fiGoal: getFiTarget(nextGoal, birthday, growth, undefined, undefined, inflation),
  }
}

interface GoalMixerProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  profileBirthday: string
  inflation?: number
  onCreateGoal: (goal: FinancialGoal) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onClose: () => void
  onGoToGoal: (goalId: number) => void
}

const GoalMixer: FC<GoalMixerProps> = ({
  goals,
  gwGoals,
  profileBirthday,
  inflation = 3,
  onCreateGoal,
  onCreateGwGoal,
  onClose,
  onGoToGoal,
}) => {
  const firstGoal = goals[0] ?? null
  const [selectedBaseKey, setSelectedBaseKey] = useState<string | null>(firstGoal ? goalKey(firstGoal.id) : null)
  const [baseParams, setBaseParams] = useState<BaseParams>(firstGoal ? getBaseParamsFromGoal(firstGoal) : { retirementAge: '', annualExpense: '', growth: '' })
  const [selectedGwIds, setSelectedGwIds] = useState<Set<number>>(new Set())
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    if (selectedBaseKey) {
      const goalMatch = goals.find(goal => goalKey(goal.id) === selectedBaseKey)
      if (goalMatch) return
      const templateMatch = GOAL_TEMPLATES.find(template => templateKey(template.id) === selectedBaseKey)
      if (templateMatch) return
    }

    if (goals[0]) {
      setSelectedBaseKey(goalKey(goals[0].id))
      setBaseParams(getBaseParamsFromGoal(goals[0]))
      return
    }

    setSelectedBaseKey(null)
    setBaseParams({ retirementAge: '', annualExpense: '', growth: '' })
  }, [goals, selectedBaseKey])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedBaseSource = useMemo<BaseSource | null>(() => {
    if (!selectedBaseKey) return null
    const goal = goals.find(item => goalKey(item.id) === selectedBaseKey)
    if (goal) return { kind: 'goal', key: selectedBaseKey, goal }
    const template = GOAL_TEMPLATES.find(item => templateKey(item.id) === selectedBaseKey)
    return template ? { kind: 'template', key: selectedBaseKey, template } : null
  }, [goals, selectedBaseKey])

  const selectedTemplate = selectedBaseSource?.kind === 'template' ? selectedBaseSource.template : null
  const selectedGoal = useMemo(() => {
    if (!selectedBaseSource) return null
    return selectedBaseSource.kind === 'template'
      ? createSyntheticGoal(selectedBaseSource.template, profileBirthday, inflation, baseParams)
      : createGoalVariant(selectedBaseSource.goal, profileBirthday, inflation, baseParams)
  }, [selectedBaseSource, profileBirthday, inflation, baseParams])

  const toggleGw = (id: number) => {
    setSelectedGwIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedGwGoals = gwGoals.filter(g => selectedGwIds.has(g.id))

  const gwByGoal = useMemo(() => {
    const map = new Map<number, { goal: FinancialGoal; goals: GwGoal[] }>()
    for (const gw of gwGoals) {
      const goal = goals.find(item => item.id === gw.fiGoalId)
      if (!goal) continue
      if (!map.has(goal.id)) map.set(goal.id, { goal, goals: [] })
      map.get(goal.id)!.goals.push(gw)
    }
    return [...map.values()]
  }, [gwGoals, goals])

  const gwTotal = useMemo(() => {
    if (!selectedGoal) return 0
    return selectedGwGoals.reduce((sum, gw) => sum + computeGwPv(gw, selectedGoal, profileBirthday, inflation), 0)
  }, [selectedGwGoals, selectedGoal, profileBirthday, inflation])

  const fiTargets = useMemo(
    () => new Map(goals.map(goal => [goal.id, getFiTarget(goal, profileBirthday, goal.growth || 8, undefined, undefined, inflation)])),
    [goals, profileBirthday, inflation],
  )

  const selectedGoalFiTarget = selectedGoal?.fiGoal ?? 0
  const totalAtRetirement = selectedGoalFiTarget + gwTotal

  const selectGoalBase = (goal: FinancialGoal) => {
    setSelectedBaseKey(goalKey(goal.id))
    setBaseParams(getBaseParamsFromGoal(goal))
  }

  const selectTemplateBase = (template: GoalTemplate) => {
    setSelectedBaseKey(templateKey(template.id))
    setBaseParams(getBaseParamsFromTemplate(template))
  }

  const handleBaseParamChange = (field: keyof BaseParams) => (event: ChangeEvent<HTMLInputElement>) => {
    setBaseParams(prev => ({
      ...prev,
      [field]: event.target.value,
    }))
  }

  const handleCreate = () => {
    if (!selectedGoal) return
    const newId = Date.now()
    const newGoal: FinancialGoal = {
      ...selectedGoal,
      id: newId,
      goalName: `${selectedGoal.goalName} – Mixed`,
      createdAt: createdAtLabel(),
      progress: selectedBaseSource?.kind === 'template' ? 0 : selectedGoal.progress,
    }
    onCreateGoal(newGoal)
    selectedGwGoals.forEach(gw => {
      const { id: _id, createdAt: _createdAt, ...rest } = gw
      onCreateGwGoal({ ...rest, fiGoalId: newId })
    })
    onClose()
    onGoToGoal(newId)
  }

  const retirementYear = selectedGoal ? new Date(profileBirthday).getFullYear() + selectedGoal.retirementAge : null
  const showTemplateHint = goals.length === 0 && !selectedBaseSource

  const getTemplateChipState = (template: GoalTemplate): '' | ' selected' | ' partial' => {
    if (selectedTemplate?.id !== template.id) return ''

    const matchesTemplate =
      baseParams.retirementAge === String(template.retirementAge) &&
      baseParams.annualExpense === String(template.annualExpense) &&
      baseParams.growth === String(template.growth)

    return matchesTemplate ? ' selected' : ' partial'
  }

  return (
    <div className="mixer-backdrop" onClick={onClose}>
      <div ref={modalRef} className="mixer-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mixer-header">
          <div>
            <h2 className="mixer-title">Mix &amp; Match</h2>
            <p className="mixer-subtitle">Pick an FI base and any GW goals to preview a combined goal</p>
          </div>
        </div>

        <div className="mixer-body">
          <div className="mixer-template-strip">
            <div className="mixer-template-strip-label">Start from a template</div>
            <div className="mixer-template-chip-list" role="group" aria-label="Start from a template">
              {GOAL_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className={`mixer-template-chip${getTemplateChipState(template)}`}
                  aria-pressed={selectedTemplate?.id === template.id}
                  onClick={() => selectTemplateBase(template)}
                >
                  <span className="mixer-template-chip-name">{template.name}</span>
                  <span className="mixer-template-chip-meta">
                    Age {template.retirementAge} · {dollars(template.annualExpense)}/yr · {template.growth}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mixer-grid">
            <div className="mixer-col">
              <div className="mixer-col-title">
                <span className="mixer-badge mixer-badge--fi">FI</span>
                Base Goal
              </div>
              {showTemplateHint && <p className="mixer-empty mixer-empty--hint">Pick a template to get started</p>}
              <div className="mixer-goal-list">
                {goals.map(goal => {
                  const fiTarget = fiTargets.get(goal.id) ?? 0
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      className={`mixer-goal-item${selectedBaseKey === goalKey(goal.id) ? ' selected' : ''}`}
                      onClick={() => selectGoalBase(goal)}
                    >
                      <span className="mixer-goal-name">{goal.goalName}</span>
                      <span className="mixer-goal-stat">
                        FI Goal <strong>{fiDisplay(fiTarget)}</strong>
                      </span>
                      <span className="mixer-goal-stat">
                        Retire {new Date(profileBirthday).getFullYear() + goal.retirementAge}
                        &nbsp;·&nbsp;{inflation}% infl
                      </span>
                    </button>
                  )
                })}
              </div>

              {selectedBaseSource ? (
                <div className="mixer-params">
                  <div className="mixer-col-title mixer-col-title--params">Base Parameters</div>
                  <div className="mixer-param-grid">
                    <label className="mixer-param-field">
                      <span className="mixer-param-label">Retirement age</span>
                      <input
                        type="number"
                        className="mixer-param-input"
                        value={baseParams.retirementAge}
                        onChange={handleBaseParamChange('retirementAge')}
                        min="1"
                        aria-label="Retirement age"
                      />
                      {selectedTemplate && <span className="mixer-param-attribution">from {selectedTemplate.name}</span>}
                    </label>
                    <label className="mixer-param-field">
                      <span className="mixer-param-label">Annual expense</span>
                      <input
                        type="number"
                        className="mixer-param-input"
                        value={baseParams.annualExpense}
                        onChange={handleBaseParamChange('annualExpense')}
                        min="1"
                        step="1000"
                        aria-label="Annual expense"
                      />
                      {selectedTemplate && <span className="mixer-param-attribution">from {selectedTemplate.name}</span>}
                    </label>
                    <label className="mixer-param-field">
                      <span className="mixer-param-label">Growth</span>
                      <input
                        type="number"
                        className="mixer-param-input"
                        value={baseParams.growth}
                        onChange={handleBaseParamChange('growth')}
                        step="0.1"
                        aria-label="Growth"
                      />
                      {selectedTemplate && <span className="mixer-param-attribution">from {selectedTemplate.name}</span>}
                    </label>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mixer-col">
              <div className="mixer-col-title">
                <span className="mixer-badge mixer-badge--gw">GW</span>
                Goals
                {!selectedGoal && <span className="mixer-col-hint">(select FI base first)</span>}
              </div>
              {gwByGoal.length === 0 ? (
                <p className="mixer-empty">No GW goals found across any goals.</p>
              ) : (
                <div className="mixer-gw-list">
                  {gwByGoal.map(({ goal, goals: groupedGoals }) => (
                    <div key={goal.id} className="mixer-gw-group">
                      <div className="mixer-gw-group-label">from "{goal.goalName}"</div>
                      {groupedGoals.map(gw => {
                        const pv = selectedGoal ? computeGwPv(gw, selectedGoal, profileBirthday, inflation) : 0
                        const isChecked = selectedGwIds.has(gw.id)
                        return (
                          <label key={gw.id} className={`mixer-gw-item${isChecked ? ' checked' : ''}`}>
                            <input
                              type="checkbox"
                              className="mixer-gw-checkbox"
                              checked={isChecked}
                              onChange={() => toggleGw(gw.id)}
                            />
                            <span className="mixer-gw-label">{gw.label || 'Unnamed goal'}</span>
                            <span className="mixer-gw-meta">
                              age {gw.disburseAge} · {gw.growthRate}%
                            </span>
                            {selectedGoal && <span className="mixer-gw-pv">{dollars(pv)}</span>}
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mixer-preview">
          <div className="mixer-preview-heading">
            Preview at retirement{retirementYear ? ` (${retirementYear})` : ''}
          </div>
          {selectedGoal ? (
            <div className="mixer-preview-rows">
              <div className="mixer-preview-row">
                <span className="mixer-preview-label">
                  <span className="mixer-badge mixer-badge--fi mixer-badge--sm">FI</span>
                  {selectedGoal.goalName}
                </span>
                <span className="mixer-preview-amount">{fiDisplay(selectedGoalFiTarget)}</span>
              </div>
              {selectedGwGoals.map(gw => (
                <div key={gw.id} className="mixer-preview-row mixer-preview-row--gw">
                  <span className="mixer-preview-label">
                    <span className="mixer-badge mixer-badge--gw mixer-badge--sm">GW</span>
                    {gw.label || 'Unnamed goal'}
                  </span>
                  <span className="mixer-preview-amount mixer-preview-amount--gw">
                    {dollars(computeGwPv(gw, selectedGoal, profileBirthday, inflation))}
                  </span>
                </div>
              ))}
              {selectedGwGoals.length > 0 && (
                <div className="mixer-preview-row mixer-preview-row--total">
                  <span className="mixer-preview-label">Total</span>
                  <span className="mixer-preview-amount mixer-preview-amount--total">{dollars(totalAtRetirement)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="mixer-empty">Select an FI base to see a preview.</p>
          )}
        </div>

        <div className="mixer-footer">
          <button className="mixer-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="mixer-btn-create" disabled={!selectedGoal} onClick={handleCreate}>
            Create as New Goal →
          </button>
        </div>
      </div>
    </div>
  )
}

export default GoalMixer
