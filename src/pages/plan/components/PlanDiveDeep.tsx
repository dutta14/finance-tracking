import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import './PlanDiveDeep.css'

interface PlanDiveDeepProps {
  plan: FinancialPlan
}

const PlanDiveDeep: FC<PlanDiveDeepProps> = ({ plan }) => {
  return (
    <div className="dive-deep-container">
      <h3 className="dive-deep-title">Deep Analysis — {plan.planName}</h3>

      <div className="dive-deep-section">
        <h4>Year-by-Year Projection</h4>
        <p className="dive-deep-placeholder">Coming soon: annual expense, portfolio growth, and withdrawal projections from {plan.planCreatedIn ? new Date(plan.planCreatedIn).getFullYear() : '—'} to {plan.planEndYear ? new Date(plan.planEndYear).getFullYear() : '—'}.</p>
      </div>

      <div className="dive-deep-section">
        <h4>Inflation Impact</h4>
        <p className="dive-deep-placeholder">Coming soon: how {plan.inflationRate}% inflation erodes purchasing power over time.</p>
      </div>

      <div className="dive-deep-section">
        <h4>Withdrawal Simulation</h4>
        <p className="dive-deep-placeholder">Coming soon: safe withdrawal scenario at {plan.safeWithdrawalRate}% rate against your FI goal of ${plan.fiGoal.toLocaleString()}.</p>
      </div>

      <div className="dive-deep-section">
        <h4>Portfolio Growth</h4>
        <p className="dive-deep-placeholder">Coming soon: projected portfolio growth at {plan.growth}% annually.</p>
      </div>
    </div>
  )
}

export default PlanDiveDeep
