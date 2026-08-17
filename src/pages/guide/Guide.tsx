import { FC, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import GuideSearch from './components/GuideSearch'
import GuideTOC, { GuideSectionLink } from './components/GuideTOC'
import HeroContent from './sections/HeroContent'
import WhyThisExists from './sections/WhyThisExists'
import PrivacyAndData from './sections/PrivacyAndData'
import QuickStart from './sections/QuickStart'
import FeaturesByPage from './sections/FeaturesByPage'
import CommonQuestions from './sections/CommonQuestions'
import More from './sections/More'
import '../../styles/Guide.css'

import homeLight from '../../../docs/screenshots/home-light.png'
import homeDark from '../../../docs/screenshots/home-dark.png'
import quickstart1 from '../../../docs/screenshots/quickstart-1.png'
import quickstart2 from '../../../docs/screenshots/quickstart-2.png'
import quickstart3 from '../../../docs/screenshots/quickstart-3.png'
import quickstart4 from '../../../docs/screenshots/quickstart-4.png'
import quickstart5 from '../../../docs/screenshots/quickstart-5.png'
import goals from '../../../docs/screenshots/goals.png'
import netWorth from '../../../docs/screenshots/networth.png'
import budgetImage from '../../../docs/screenshots/budget.png'
import transactionsImage from '../../../docs/screenshots/transactions.png'
import taxes from '../../../docs/screenshots/taxes.png'
import driveImage from '../../../docs/screenshots/drive.png'
import allocationImage from '../../../docs/screenshots/allocation.png'
import growthImage from '../../../docs/screenshots/growth.png'
import settings from '../../../docs/screenshots/settings.png'

const tocItems: GuideSectionLink[] = [
  { id: 'why-this-exists', title: 'Why this exists', keywords: ['story', 'purpose'] },
  { id: 'privacy', title: 'Privacy & data', keywords: ['security', 'encryption', 'storage'] },
  { id: 'where-your-data-lives', title: 'Where your data lives', level: 3, keywords: ['localstorage', 'indexeddb'] },
  { id: 'encrypted-at-rest', title: 'What encrypted at rest means', level: 3, keywords: ['aes', 'pbkdf2', 'passphrase'] },
  { id: 'github-sync', title: 'What GitHub Sync does', level: 3, keywords: ['backup', 'private repo'] },
  { id: 'what-this-app-does-not-do', title: 'What this app does not do', level: 3, keywords: ['analytics', 'telemetry', 'backend'] },
  { id: 'trade-off', title: 'The trade-off, stated honestly', level: 3, keywords: ['recovery', 'reset'] },
  { id: 'quick-start', title: 'Quick start', keywords: ['setup', 'first steps'] },
  { id: 'features-by-page', title: 'Features, by page', keywords: ['pages', 'navigation'] },
  { id: 'feature-home', title: 'Home', level: 3, keywords: ['dashboard', 'cards'] },
  { id: 'feature-goals', title: 'Goals', level: 3, keywords: ['plans', 'fi calculator'] },
  { id: 'feature-net-worth', title: 'Net Worth', level: 3, keywords: ['accounts', 'allocation', 'growth'] },
  { id: 'feature-budget', title: 'Budget', level: 3, keywords: ['cashflow', 'csv', 'converter'] },
  { id: 'feature-transactions', title: 'Transactions', level: 3, keywords: ['categorization', 'filters'] },
  { id: 'feature-taxes', title: 'Taxes', level: 3, keywords: ['documents', 'checklists'] },
  { id: 'feature-drive', title: 'Drive', level: 3, keywords: ['files', 'csv preview', 'breadcrumbs'] },
  { id: 'feature-settings', title: 'Settings', level: 3, keywords: ['appearance', 'advanced', 'labs'] },
  { id: 'common-questions', title: 'Common questions', keywords: ['faq'] },
  { id: 'more', title: 'More', keywords: ['links', 'source', 'contributing'] },
]

const Guide: FC = () => {
  const location = useLocation()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (!hash) return

    const sectionId = decodeURIComponent(hash)
    const scrollToSection = () => {
      const element = document.getElementById(sectionId)
      if (!element) return
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
    }

    window.requestAnimationFrame(scrollToSection)
  }, [location.hash])

  const matchCount = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase()
    if (!trimmedQuery) return tocItems.length
    return tocItems.filter(item => [item.title, ...(item.keywords ?? [])].join(' ').toLowerCase().includes(trimmedQuery)).length
  }, [query])

  return (
    <article className="guide-page">
      <div className="guide-shell">
        <HeroContent heroLightSrc={homeLight} heroDarkSrc={homeDark} />

        <div className="guide-toolbar">
          <GuideSearch matchCount={matchCount} totalCount={tocItems.length} onQueryChange={setQuery} />
        </div>

        <div className="guide-layout">
          <div className="guide-content">
            <WhyThisExists />
            <PrivacyAndData />
            <QuickStart
              screenshots={{
                step1: quickstart1,
                step2: quickstart2,
                step3: quickstart3,
                step4: quickstart4,
                step5: quickstart5,
              }}
            />
            <FeaturesByPage
              screenshots={{
                home: homeLight,
                goals,
                netWorth,
                budget: budgetImage,
                transactions: transactionsImage,
                taxes,
                drive: driveImage,
                allocation: allocationImage,
                growth: growthImage,
                settings,
              }}
            />
            <CommonQuestions />
            <More />
          </div>

          <GuideTOC items={tocItems} query={query} />
        </div>
      </div>
    </article>
  )
}

export default Guide
