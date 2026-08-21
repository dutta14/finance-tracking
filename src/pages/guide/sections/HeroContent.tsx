import { FC } from 'react'
import { useDarkMode } from '../../../hooks/useDarkMode'
import GuideFigure from '../components/GuideFigure'

interface HeroContentProps {
  heroLightSrc: string
  heroDarkSrc: string
}

const HeroContent: FC<HeroContentProps> = ({ heroLightSrc, heroDarkSrc }) => {
  const darkMode = useDarkMode()

  return (
    <header className="guide-hero">
      <div className="guide-hero-copy">
        <p className="guide-eyebrow">Finance Tracker</p>
        <h1>Your money, in your browser, and nowhere else.</h1>
        <p>
          This is a personal finance app for one person, and it lives entirely on your computer. It tracks your net
          worth, your budget, your transactions, your savings goals, your tax documents, and the little Sunday-morning
          habits that make all of that sustainable over time; your data stays in a folder you choose, as plain files you
          can read, and never touches a server I run.
        </p>
        <ul className="guide-bullet-list guide-bullet-list--hero">
          <li>Your folder, your files.</li>
          <li>Plain JSON and CSV.</li>
          <li>No lock-in.</li>
        </ul>
      </div>
      <GuideFigure
        src={darkMode ? heroDarkSrc : heroLightSrc}
        alt="Finance Tracker home dashboard in light and dark themes"
        loading="eager"
      />
    </header>
  )
}

export default HeroContent
