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
          This is a personal finance app for one person, and it lives entirely in your browser. It tracks your net
          worth, your budget, your transactions, your savings goals, your tax documents, and the little Sunday-morning
          habits that make all of that sustainable over time; the data can be encrypted on your device with a passphrase
          you choose, and never touches a server I run.
        </p>
        <ul className="guide-bullet-list guide-bullet-list--hero">
          <li>Browser only.</li>
          <li>Encrypted on your device.</li>
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
