import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Drive from './Drive'
import type { DriveFolder } from './types'

/* ─── Mock dependencies ─── */

vi.mock('../../styles/Drive.css', () => ({}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockBuildDriveTree = vi.fn<() => DriveFolder>()
vi.mock('./buildBudgetTree', () => ({
  buildDriveTree: () => mockBuildDriveTree(),
}))

vi.mock('./CSVViewer', () => ({
  default: ({ label, onBack }: { label: string; onBack: () => void }) => (
    <div data-testid="csv-viewer">
      <span>{label}</span>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}))

vi.mock('../budget/components/CSVPreviewModal', () => ({
  default: () => <div data-testid="csv-preview-modal">Preview Modal</div>,
}))

vi.mock('./useDriveUpload', () => ({
  useDriveUpload: () => ({
    csvPreview: null,
    toastMsg: null,
    dismissToast: vi.fn(),
    dragOver: false,
    fileInputRef: { current: null },
    handlePreviewConfirm: vi.fn(),
    handlePreviewCancel: vi.fn(),
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleFileInputChange: vi.fn(),
    openFilePicker: vi.fn(),
  }),
}))

vi.mock('../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(() => ({ csvs: {} })),
  saveBudgetStore: vi.fn(),
  renameBudgetMonth: vi.fn(),
}))

vi.mock('../budget/utils/csvParser', () => ({
  formatMonthKey: vi.fn((k: string) => k),
}))

/* ─── Helpers ─── */

function makeEmptyRoot(): DriveFolder {
  return { name: 'Drive', slug: '', folders: [], files: [] }
}

function makeTreeWithFiles(): DriveFolder {
  return {
    name: 'Drive',
    slug: '',
    folders: [
      {
        name: 'Budget',
        slug: 'budget',
        folders: [
          {
            name: '2025',
            slug: '2025',
            folders: [],
            files: [
              {
                name: 'January 2025',
                slug: '2025-01',
                ext: 'csv',
                content: 'Date,Amount\n2025-01-15,-100',
                uploadedAt: '2025-01-20T00:00:00Z',
              },
              {
                name: 'February 2025',
                slug: '2025-02',
                ext: 'csv',
                content: 'Date,Amount\n2025-02-15,-200',
                uploadedAt: '2025-02-20T00:00:00Z',
              },
            ],
          },
        ],
        files: [],
      },
    ],
    files: [],
  }
}

function makeTreeWithCsvFile(): DriveFolder {
  return {
    name: 'Drive',
    slug: '',
    folders: [],
    files: [
      {
        name: 'report.csv',
        slug: 'report.csv',
        ext: 'csv',
        content: 'A,B\n1,2',
        uploadedAt: '2025-01-01T00:00:00Z',
      },
    ],
  }
}

function makeTreeWithMetaFiles(): DriveFolder {
  return {
    name: 'Drive',
    slug: '',
    folders: [
      {
        name: 'Data',
        slug: 'data',
        folders: [],
        files: [
          {
            name: 'File A',
            slug: 'file-a',
            ext: 'csv',
            content: '',
            uploadedAt: '2025-01-10T00:00:00Z',
            meta: { owner: 'Primary' },
          },
          {
            name: 'File B',
            slug: 'file-b',
            ext: 'csv',
            content: '',
            uploadedAt: '2025-03-05T00:00:00Z',
            meta: { owner: 'Partner' },
          },
          {
            name: 'File C',
            slug: 'file-c',
            ext: 'csv',
            content: '',
            uploadedAt: '2025-02-15T00:00:00Z',
            meta: { owner: 'Primary' },
          },
        ],
      },
    ],
    files: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockBuildDriveTree.mockReturnValue(makeTreeWithFiles())
})

function renderDrive(initialEntry = '/drive') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Drive />
    </MemoryRouter>,
  )
}

/* ═══════════════════════════════════════════════════════════════
   Basic rendering
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — basic rendering', () => {
  it('renders the Drive title', () => {
    renderDrive()
    expect(screen.getByRole('heading', { level: 1, name: 'Drive' })).toBeInTheDocument()
  })

  it('renders the breadcrumb with Drive as root', () => {
    renderDrive()
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Drive')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Folder listing
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — folder listing', () => {
  it('renders subfolders at root', () => {
    renderDrive()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('navigates into a folder on click', async () => {
    renderDrive()
    await userEvent.click(screen.getByText('Budget'))
    expect(mockNavigate).toHaveBeenCalledWith('/drive/budget')
  })
})

/* ═══════════════════════════════════════════════════════════════
   File listing inside a folder
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — file listing', () => {
  it('renders files when navigated into a year folder', () => {
    renderDrive('/drive/budget/2025')
    expect(screen.getByText('January 2025')).toBeInTheDocument()
    expect(screen.getByText('February 2025')).toBeInTheDocument()
  })

  it('navigates to a file on click', async () => {
    renderDrive('/drive/budget/2025')
    await userEvent.click(screen.getByText('January 2025'))
    expect(mockNavigate).toHaveBeenCalledWith('/drive/budget/2025/2025-01')
  })
})

/* ═══════════════════════════════════════════════════════════════
   CSV viewer for CSV files
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — CSV viewer', () => {
  it('shows CSV viewer when navigated to a CSV file', () => {
    mockBuildDriveTree.mockReturnValue(makeTreeWithCsvFile())
    renderDrive('/drive/report.csv')
    expect(screen.getByTestId('csv-viewer')).toBeInTheDocument()
    expect(screen.getByText('report.csv')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Empty folder state
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — empty state', () => {
  it('shows empty message when root has no folders or files', () => {
    mockBuildDriveTree.mockReturnValue(makeEmptyRoot())
    renderDrive()
    expect(screen.getByText(/No budget files yet/)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Back navigation
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — back navigation', () => {
  it('renders a back row (..) when not at root', () => {
    renderDrive('/drive/budget')
    expect(screen.getByText('..')).toBeInTheDocument()
  })

  it('does not render a back row at root', () => {
    renderDrive()
    expect(screen.queryByText('..')).not.toBeInTheDocument()
  })

  it('navigates up when clicking the back row', async () => {
    renderDrive('/drive/budget')
    await userEvent.click(screen.getByText('..'))
    expect(mockNavigate).toHaveBeenCalledWith('/drive')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Sort files by date
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — sort by date', () => {
  it('renders sort controls when files have owner metadata', () => {
    mockBuildDriveTree.mockReturnValue(makeTreeWithMetaFiles())
    renderDrive('/drive/data')
    expect(screen.getByText('Sort:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument()
  })

  it('sorts files by date when Date sort button is clicked', async () => {
    mockBuildDriveTree.mockReturnValue(makeTreeWithMetaFiles())
    renderDrive('/drive/data')

    await userEvent.click(screen.getByRole('button', { name: 'Date' }))

    // Most recent first: File B (Mar), File C (Feb), File A (Jan)
    const fileNames = screen.getAllByText(/^File [ABC]$/).map(el => el.textContent)
    expect(fileNames).toEqual(['File B', 'File C', 'File A'])
  })
})

/* ═══════════════════════════════════════════════════════════════
   Drop zone
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — drop zone', () => {
  it('renders the drop zone when inside a subfolder (not root)', () => {
    renderDrive('/drive/budget')
    expect(screen.getByText(/Drag & drop CSV files or click to browse/)).toBeInTheDocument()
  })

  it('does not render the drop zone at root', () => {
    renderDrive()
    expect(screen.queryByText(/Drag & drop CSV files/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Owner filter
   ═══════════════════════════════════════════════════════════════ */

describe('Drive — owner filter', () => {
  it('filters files by owner when a filter button is clicked', async () => {
    mockBuildDriveTree.mockReturnValue(makeTreeWithMetaFiles())
    renderDrive('/drive/data')

    await userEvent.click(screen.getByRole('button', { name: 'Partner' }))

    expect(screen.getByText('File B')).toBeInTheDocument()
    expect(screen.queryByText('File A')).not.toBeInTheDocument()
    expect(screen.queryByText('File C')).not.toBeInTheDocument()
  })
})
