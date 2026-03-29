import { FC, useState } from 'react'
import { PageType } from './types'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import Plan from './pages/plan/Plan'

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('home')

  const renderPage = (): React.ReactNode => {
    switch (currentPage) {
      case 'plan':
        return <Plan />
      case 'home':
      default:
        return <Home />
    }
  }

  return (
    <div className="app-container">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
