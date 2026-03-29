import './Navigation.css'

function Navigation({ currentPage, setCurrentPage }) {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          Finance Tracker
        </div>
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
      </div>
    </nav>
  )
}

export default Navigation
