import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchModal from './SearchModal'
import type { SearchGroup, SearchItem } from '../search/searchIndex'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const makeItem = (overrides: Partial<SearchItem> = {}): SearchItem => ({
  id: 'page-home',
  category: 'page',
  label: 'Home',
  hint: 'Dashboard overview',
  icon: 'home',
  keywords: ['home', 'dashboard'],
  route: '/',
  ...overrides,
})

const makeGroup = (overrides: Partial<SearchGroup> = {}): SearchGroup => ({
  category: 'page',
  label: 'Pages',
  items: [makeItem()],
  total: 1,
  ...overrides,
})

vi.mock('../search/searchIndex', () => ({
  buildIndex: vi.fn(() => []),
  search: vi.fn(() => []),
  findMatchRange: vi.fn(() => null),
  getCategoryLabel: vi.fn((cat: string) => cat),
}))

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

import { buildIndex, search, findMatchRange, getCategoryLabel } from '../search/searchIndex'

const mockedBuildIndex = vi.mocked(buildIndex)
const mockedSearch = vi.mocked(search)
const mockedFindMatchRange = vi.mocked(findMatchRange)
const mockedGetCategoryLabel = vi.mocked(getCategoryLabel)

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
  onAction: vi.fn(),
}

describe('SearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedBuildIndex.mockReturnValue([])
    mockedSearch.mockReturnValue([])
    mockedFindMatchRange.mockReturnValue(null)
    mockedGetCategoryLabel.mockImplementation((cat: string) => cat)
  })

  it('does not render when closed', () => {
    render(<SearchModal {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders focused search input when open', () => {
    render(<SearchModal {...defaultProps} />)
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows empty state when no query', () => {
    mockedSearch.mockReturnValue([])
    render(<SearchModal {...defaultProps} />)
    expect(screen.getByText('Quick actions')).toBeInTheDocument()
    expect(screen.getByText('Start typing, or choose a command')).toBeInTheDocument()
  })

  it('shows grouped results as user types', async () => {
    const items = [
      makeItem({ id: 'page-home', label: 'Home', hint: 'Dashboard' }),
      makeItem({ id: 'page-goals', label: 'Goals', hint: 'FI goal plans' }),
    ]
    const groups = [makeGroup({ items, total: 2 })]
    mockedSearch.mockReturnValue(groups)

    render(<SearchModal {...defaultProps} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'ho')

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Goals')).toBeInTheDocument()
  })

  it('highlights matching text via findMatchRange', async () => {
    const items = [makeItem({ id: 'page-home', label: 'Home', hint: 'Dashboard' })]
    mockedSearch.mockReturnValue([makeGroup({ items, total: 1 })])
    mockedFindMatchRange.mockReturnValue([0, 2])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'Ho')

    // Verify findMatchRange was called with the label and query
    expect(mockedFindMatchRange).toHaveBeenCalledWith('Home', 'Ho')
    // Verify the component splits the label at the match range
    expect(screen.getByText('Ho')).toBeInTheDocument()
    expect(screen.getByText('me')).toBeInTheDocument()
    // The matched portion should be wrapped in a <mark> element
    const mark = screen.getByText('Ho').closest('mark')
    expect(mark).not.toBeNull()
  })

  it('navigates on Enter for route results', async () => {
    const items = [makeItem({ id: 'page-home', label: 'Home', route: '/' })]
    mockedSearch.mockReturnValue([makeGroup({ items, total: 1 })])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'home')
    await userEvent.keyboard('{Enter}')

    expect(defaultProps.onClose).toHaveBeenCalled()
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('/')
  })

  it('calls onAction for action results on Enter', async () => {
    const actionItem = makeItem({
      id: 'cmd-dark',
      label: 'Toggle Dark Mode',
      route: '',
      actionId: 'toggle-dark-mode',
    })
    mockedSearch.mockReturnValue([makeGroup({ category: 'command', label: 'Commands', items: [actionItem], total: 1 })])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'dark')
    await userEvent.keyboard('{Enter}')

    expect(defaultProps.onClose).toHaveBeenCalled()
    expect(defaultProps.onAction).toHaveBeenCalledWith('toggle-dark-mode')
  })

  it('moves selection with ArrowDown and ArrowUp', async () => {
    const items = [
      makeItem({ id: 'p1', label: 'Home', route: '/' }),
      makeItem({ id: 'p2', label: 'Goals', route: '/goal' }),
    ]
    mockedSearch.mockReturnValue([makeGroup({ items, total: 2 })])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'h')

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')

    await userEvent.keyboard('{ArrowDown}')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowUp}')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onClose when Escape is pressed', async () => {
    render(<SearchModal {...defaultProps} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '{Escape}')
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows no results message when query has no matches', async () => {
    mockedSearch.mockReturnValue([])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'xyznotexist')

    expect(screen.getByText(/No results for/)).toBeInTheDocument()
    expect(screen.getByText('Try a different keyword or check spelling')).toBeInTheDocument()
  })

  it('shows "Show all" button when group is truncated', async () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem({ id: `p${i}`, label: `Item ${i}` }))
    const groups = [makeGroup({ items, total: 10 })]
    mockedSearch.mockReturnValue(groups)

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'item')

    expect(screen.getByText('Show all 10 results →')).toBeInTheDocument()
  })

  it('updates selection on mouse hover', async () => {
    const items = [
      makeItem({ id: 'p1', label: 'Home', route: '/' }),
      makeItem({ id: 'p2', label: 'Goals', route: '/goal' }),
    ]
    mockedSearch.mockReturnValue([makeGroup({ items, total: 2 })])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'h')

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await userEvent.hover(options[1])
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('navigates on clicking a result', async () => {
    const items = [makeItem({ id: 'p1', label: 'Home', route: '/' })]
    mockedSearch.mockReturnValue([makeGroup({ items, total: 1 })])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'home')
    await userEvent.click(screen.getByRole('option', { name: /Home/ }))

    expect(defaultProps.onClose).toHaveBeenCalled()
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('/')
  })

  it('closes when clicking overlay background', async () => {
    render(<SearchModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog', { name: 'Search' })
    await userEvent.click(dialog.parentElement!)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('does not move selection below last item with ArrowDown', async () => {
    const items = [makeItem({ id: 'p1', label: 'Home', route: '/' })]
    mockedSearch.mockReturnValue([makeGroup({ items, total: 1 })])

    render(<SearchModal {...defaultProps} />)
    await userEvent.type(screen.getByRole('combobox'), 'h')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}')

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })
})
