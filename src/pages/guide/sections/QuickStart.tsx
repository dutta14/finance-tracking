import { FC } from 'react'
import GuideFigure from '../components/GuideFigure'

interface QuickStartProps {
  screenshots: {
    step1: string
    step2: string
    step3: string
    step4: string
    step5: string
  }
}

const QuickStart: FC<QuickStartProps> = ({ screenshots }) => {
  const steps = [
    {
      id: 'quick-start-open',
      title: 'Open the app',
      body: 'Go to anindya.dev/finance-tracking in any modern browser. Nothing to install. No signup screen. You land on Home, and from there the rest of the app opens up gradually as you add real data.',
      image: screenshots.step1,
      alt: 'Landing page on first open',
    },
    {
      id: 'quick-start-folder',
      title: 'Pick a data folder',
      body: 'When you first open the app, it asks you to select a folder on your computer. This is where all your data will be stored as plain JSON and CSV files. Create a new folder or pick an existing one. Your browser will remember the choice, though it may ask for permission again after a restart.',
      image: screenshots.step2,
      alt: 'Folder picker on first open',
    },
    {
      id: 'quick-start-first-account',
      title: 'Add your first account',
      body: 'Go to Net Worth → Accounts and add an account you actually look at every month, a checking account or retirement account works well. Give it a name, pick a type, and save. This is the foundation the dashboard, allocation planner, and goals all build on.',
      image: screenshots.step3,
      alt: 'Add account form',
    },
    {
      id: 'quick-start-balance',
      title: 'Enter a monthly balance',
      body: "Open that account and add this month's balance. That is enough to make the charts wake up. Come back next month and add another point. You do not need perfect history to get value from it.",
      image: screenshots.step4,
      alt: 'Enter monthly balance',
    },
    {
      id: 'quick-start-explore',
      title: 'Let the rest of the app unfold from there',
      body: "Go back Home. You'll see the net worth summary, mini charts, goals peek, and allocation bar start to take shape. From there, add a goal, import a budget CSV, or drop your tax documents into Drive. The app is modular. You can grow into it.",
      image: screenshots.step5,
      alt: 'Net worth on the home dashboard',
    },
  ]

  return (
    <section className="guide-section" id="quick-start">
      <h2>Quick start (5 minutes)</h2>
      <ol className="guide-step-list">
        {steps.map((step, index) => (
          <li className="guide-step" id={step.id} key={step.id}>
            <div className="guide-step-copy">
              <h3>
                <span className="guide-step-number">{index + 1}</span>
                {step.title}
              </h3>
              <p>{step.body}</p>
            </div>
            <GuideFigure src={step.image} alt={step.alt} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export default QuickStart
