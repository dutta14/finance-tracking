import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('./pages/home/Home', () => ({ default: () => <div data-testid="page-home">Home Page</div> }))
vi.mock('./pages/goal/Goal', () => ({ default: () => <div data-testid="page-goal">Goal Page</div> }))
vi.mock('./pages/data/Data', () => ({ default: () => <div data-testid="page-data">Data Page</div> }))
vi.mock('./pages/budget/Budget', () => ({ default: () => <div data-testid="page-budget">Budget Page</div> }))
vi.mock('./pages/drive/Drive', () => ({ default: () => <div data-testid="page-drive">Drive Page</div> }))
vi.mock('./pages/taxes/Taxes', () => ({ default: () => <div data-testid="page-taxes">Taxes Page</div> }))

vi.mock('./search/searchIndex', () => ({
  buildIndex: vi.fn(() => []),
  search: vi.fn(() => []),
  findMatchRange: vi.fn(() => null),
  getCategoryLabel: vi.fn((cat: string) => cat),
}))

vi.mock('./hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

import { search, buildIndex } from './search/searchIndex'
const mockedSearch = vi.mocked(search)
const mockedBuildIndex = vi.mocked(buildIndex)

const renderApp = () =>
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders sidebar navigation', async () => {
    renderApp()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('renders home page by default', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByTestId('page-home')).toBeInTheDocument()
    })
  })

  it('highlights current page in sidebar', async () => {
    renderApp()
    await waitFor(() => {
      const homeBtn = screen.getByRole('button', { name: 'Home' })
      expect(homeBtn).toHaveAttribute('aria-current', 'page')
    })
  })

  it('navigates to Goals on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Goals' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-goal')).toBeInTheDocument()
    })
  })

  it('navigates to Budget on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Budget' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-budget')).toBeInTheDocument()
    })
  })

  it('navigates to Taxes on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Taxes' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-taxes')).toBeInTheDocument()
    })
  })

  it('navigates to Net Worth on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Net Worth' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-data')).toBeInTheDocument()
    })
  })

  it('opens search modal when Search button is clicked', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: /Search/ }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
  })

  it('opens search modal on Cmd+K keyboard shortcut', async () => {
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
  })

  it('wraps pages in Suspense boundary (fallback not testable with synchronous mocks)', () => {
    // Lazy page mocks resolve synchronously in vitest/JSDOM, so the Suspense
    // fallback never actually renders. This verifies the main content area
    // renders, confirming the Suspense wrapper does not break rendering.
    renderApp()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('shows sidebar toggle when sidebar is closed', async () => {
    renderApp()
    const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' })
    await userEvent.click(collapseBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    })
  })

  it('navigates to Drive on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Drive' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-drive')).toBeInTheDocument()
    })
  })

  it('redirects /data to /net-worth', async () => {
    render(
      <MemoryRouter initialEntries={['/data']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('page-data')).toBeInTheDocument()
    })
  })

  it('redirects /tools to /budget', async () => {
    render(
      <MemoryRouter initialEntries={['/tools']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('page-budget')).toBeInTheDocument()
    })
  })

  it('redirects /allocation to /net-worth/allocation', async () => {
    render(
      <MemoryRouter initialEntries={['/allocation']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('page-data')).toBeInTheDocument()
    })
  })

  it('redirects unknown routes to home', async () => {
    render(
      <MemoryRouter initialEntries={['/nonexistent']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('page-home')).toBeInTheDocument()
    })
  })

  it('renders all pages on their direct routes', async () => {
    for (const [route, testId] of [
      ['/', 'page-home'],
      ['/goal', 'page-goal'],
      ['/net-worth', 'page-data'],
      ['/budget', 'page-budget'],
      ['/drive', 'page-drive'],
      ['/taxes', 'page-taxes'],
    ] as const) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>,
      )
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument()
      })
      unmount()
    }
  })

  it('renders the main content area with correct class', async () => {
    renderApp()
    const main = screen.getByRole('main')
    expect(main).toHaveClass('main-content')
  })

  it('expands sidebar when expand button is clicked', async () => {
    renderApp()
    const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' })
    await userEvent.click(collapseBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    })
  })
})

describe('App handleSearchAction', () => {
  function setupSearchAction(actionId: string) {
    const item = {
      id: 'test-action',
      label: 'Test Action',
      hint: '',
      icon: '⚙',
      keywords: ['test'],
      route: '',
      category: 'command' as const,
      actionId,
    }
    mockedBuildIndex.mockReturnValue([item])
    mockedSearch.mockReturnValue([{ category: 'command' as const, label: 'Commands', items: [item], total: 1 }])
  }

  afterEach(() => {
    mockedBuildIndex.mockReturnValue([])
    mockedSearch.mockReturnValue([])
  })

  it('open-settings opens advanced settings section', async () => {
    setupSearchAction('open-settings')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /Advanced/, selected: true })).toBeInTheDocument()
  })

  it('open-settings-advanced opens advanced settings section', async () => {
    setupSearchAction('open-settings-advanced')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /Advanced/, selected: true })).toBeInTheDocument()
  })

  it('open-settings-profile opens profile settings section', async () => {
    setupSearchAction('open-settings-profile')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /Profile/, selected: true })).toBeInTheDocument()
  })

  it('open-settings-github opens github settings section', async () => {
    setupSearchAction('open-settings-github')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /GitHub Sync/, selected: true })).toBeInTheDocument()
  })

  it('open-settings-appearance opens appearance settings section', async () => {
    setupSearchAction('open-settings-appearance')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /Appearance/, selected: true })).toBeInTheDocument()
  })

  it('open-settings-labs opens labs settings section', async () => {
    setupSearchAction('open-settings-labs')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /Labs/, selected: true })).toBeInTheDocument()
  })

  it('toggle-dark-mode toggles dark mode on body', async () => {
    setupSearchAction('toggle-dark-mode')
    renderApp()
    const hadDark = document.body.classList.contains('dark')
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(document.body.classList.contains('dark')).toBe(!hadDark)
    })
  })

  it('new-goal navigates to /goal', async () => {
    setupSearchAction('new-goal')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByTestId('page-goal')).toBeInTheDocument()
    })
  })

  it('toggle-demo activates demo mode', async () => {
    setupSearchAction('toggle-demo')
    renderApp()
    expect(localStorage.getItem('_demo-backup')).toBeNull()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    // Verify demo mode was activated (backup key created)
    await waitFor(() => {
      expect(localStorage.getItem('_demo-backup')).not.toBeNull()
    })
  })

  it('export-data triggers export', async () => {
    setupSearchAction('export-data')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    // Verify search dialog closes (export was triggered)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument()
    })
  })
})
