import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('./pages/home/Home', () => ({ default: () => <div data-testid="page-home">Home Page</div> }))
vi.mock('./pages/goal/Goal', () => ({ default: () => <div data-testid="page-goal">Goal Page</div> }))
vi.mock('./pages/data/Data', () => ({ default: () => <div data-testid="page-data">Data Page</div> }))
vi.mock('./pages/budget/Budget', () => ({ default: () => <div data-testid="page-budget">Budget Page</div> }))
vi.mock('./pages/transactions/Transactions', () => ({
  default: () => <div data-testid="page-transactions">Transactions Page</div>,
}))
vi.mock('./pages/drive/Drive', () => ({ default: () => <div data-testid="page-drive">Drive Page</div> }))
vi.mock('./pages/taxes/Taxes', () => ({ default: () => <div data-testid="page-taxes">Taxes Page</div> }))
vi.mock('./pages/guide/Guide', () => ({ default: () => <div data-testid="page-guide">Guide Page</div> }))

vi.mock('./search/searchIndex', () => ({
  buildIndex: vi.fn(() => []),
  search: vi.fn(() => []),
  findMatchRange: vi.fn(() => null),
  getCategoryLabel: vi.fn((cat: string) => cat),
}))

vi.mock('./hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

/*
 * The real provider blocks the app behind the folder picker until a directory
 * handle is granted, which the jsdom environment cannot do. Swap in a ready
 * in-memory store so the routes under test actually render.
 */
const { mockEnterDemo, mockExitDemo, memoryStore } = vi.hoisted(() => ({
  mockEnterDemo: vi.fn(),
  mockExitDemo: vi.fn(),
  memoryStore: { current: null as unknown },
}))

vi.mock('./contexts/FileStoreContext', async () => {
  const { MemoryFileStore } = await import('./utils/memoryFileStore')
  const fileStore = new MemoryFileStore()
  memoryStore.current = fileStore
  const value = {
    fileStore,
    isReady: true,
    folderName: 'test-folder',
    disconnect: vi.fn(),
    pickFolder: vi.fn(),
    enterDemo: mockEnterDemo,
    exitDemo: mockExitDemo,
  }
  return {
    FileStoreProvider: ({ children }: { children: React.ReactNode }) => children,
    useFileStore: () => value,
    isDemoActive: () => localStorage.getItem('_demoMode') === '1',
    FileStoreContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  }
})

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

  it('navigates to Transactions on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Transactions' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-transactions')).toBeInTheDocument()
    })
  })

  it('navigates to Net Worth on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Net Worth' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-data')).toBeInTheDocument()
    })
  })

  it('navigates to Guide on sidebar click', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'User Guide' }))
    await waitFor(() => {
      expect(screen.getByTestId('page-guide')).toBeInTheDocument()
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

  it('redirects /tools to /budget/spreadsheet', async () => {
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
      ['/budget/spreadsheet', 'page-budget'],
      ['/transactions', 'page-transactions'],
      ['/drive', 'page-drive'],
      ['/taxes', 'page-taxes'],
      ['/guide', 'page-guide'],
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

  it('highlights Budget in the sidebar for nested budget routes', async () => {
    render(
      <MemoryRouter initialEntries={['/budget/cashflow']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Budget' })).toHaveAttribute('aria-current', 'page')
    })
  })

  it('highlights Transactions in the sidebar for transactions routes', async () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Transactions' })).toHaveAttribute('aria-current', 'page')
    })
  })

  it('highlights Guide in the sidebar for guide routes', async () => {
    render(
      <MemoryRouter initialEntries={['/guide']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'User Guide' })).toHaveAttribute('aria-current', 'page')
    })
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

  it('open-settings-folder opens the data folder settings section', async () => {
    setupSearchAction('open-settings-folder')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /Data Folder/, selected: true })).toBeInTheDocument()
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

  it('toggle-demo enters demo mode when it is off', async () => {
    mockEnterDemo.mockClear()
    mockExitDemo.mockClear()
    setupSearchAction('toggle-demo')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(mockEnterDemo).toHaveBeenCalledOnce()
    })
    expect(mockExitDemo).not.toHaveBeenCalled()
  })

  it('toggle-demo exits demo mode when it is already on', async () => {
    mockEnterDemo.mockClear()
    mockExitDemo.mockClear()
    localStorage.setItem('_demoMode', '1')
    setupSearchAction('toggle-demo')
    renderApp()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Test Action'))
    await waitFor(() => {
      expect(mockExitDemo).toHaveBeenCalledOnce()
    })
    expect(mockEnterDemo).not.toHaveBeenCalled()
  })
})
