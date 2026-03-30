
import { FC, useState, useEffect } from 'react'
import { NavigationProps } from '../types'
import SettingsMenu from './SettingsMenu'
import './Navigation.css'


const Navigation: FC<NavigationProps> = ({ currentPage, setCurrentPage }) => {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">Finance Tracker</div>
        <ul className="nav-menu">
          <li className="nav-item">
            <button
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
            >
              Home
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${currentPage === 'plan' ? 'active' : ''}`}
              onClick={() => setCurrentPage('plan')}
            >
              Plan
            </button>
          </li>
        </ul>
        <SettingsMenu darkMode={darkMode} onToggleDarkMode={() => setDarkMode((v) => !v)} />
      </div>
    </nav>
  )
}

export default Navigation
