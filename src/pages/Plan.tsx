import { FC, useState, ChangeEvent, FormEvent } from 'react'
import { FinancialPlan } from '../types'
import './Plan.css'

const Plan: FC = () => {
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [plans, setPlans] = useState<FinancialPlan[]>([])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.currentTarget
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCreatePlan = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (Object.keys(formData).length === 0) return

    const newPlan: FinancialPlan = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toLocaleString()
    }

    setPlans(prev => [newPlan, ...prev])
    setFormData({})
  }

  const handleDeletePlan = (id: number): void => {
    setPlans(prev => prev.filter(plan => plan.id !== id))
  }

  return (
    <div className="plan-page">
      <section className="plan-header">
        <h1>Financial Planning</h1>
        <p>Create and model different financial plans for your future</p>
      </section>

      <section className="plan-content">
        <div className="plan-container">
          <div className="plan-layout">
            {/* Form Section */}
            <div className="plan-form-section">
              <h2>Create New Plan</h2>
              <form className="plan-form" onSubmit={handleCreatePlan}>
                {/* Placeholder inputs - will be replaced with actual fields */}
                <div className="form-group">
                  <label htmlFor="planName">Plan Name</label>
                  <input
                    type="text"
                    id="planName"
                    name="planName"
                    placeholder="Enter plan name"
                    value={formData.planName || ''}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    placeholder="Describe your plan"
                    rows={3}
                    value={formData.description || ''}
                    onChange={handleInputChange}
                  ></textarea>
                </div>

                <button type="submit" className="btn-create">Create Plan</button>
              </form>
            </div>

            {/* Saved Plans Section */}
            <div className="plan-results-section">
              <h2>Saved Plans ({plans.length})</h2>
              {plans.length === 0 ? (
                <div className="empty-state">
                  <p>No plans created yet. Fill in the form and click "Create Plan" to get started.</p>
                </div>
              ) : (
                <div className="plans-grid">
                  {plans.map(plan => (
                    <div key={plan.id} className="plan-card">
                      <div className="plan-card-header">
                        <h3>{plan.planName || 'Untitled Plan'}</h3>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeletePlan(plan.id)}
                          title="Delete plan"
                        >
                          ×
                        </button>
                      </div>
                      <p className="plan-description">{plan.description}</p>
                      <div className="plan-meta">
                        <small>Created: {plan.createdAt}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Plan
