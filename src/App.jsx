import { useState } from 'react'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import Plan from './pages/Plan'

function App() {
  const [currentPage, setCurrentPage] = useState('home')

  const renderPage = () => {
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
