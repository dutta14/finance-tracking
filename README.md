# Finance Tracking

A privacy-first personal finance app that runs entirely in your browser. Track net worth, plan for financial independence, manage budgets, organize tax documents, and back everything up to GitHub — all without a server or account.

## Features

### Home Dashboard

Customizable overview with draggable cards showing net worth trends, goal progress, allocation breakdown, and mini charts. A welcome guide walks through each feature on first visit.

### Financial Goals

Plan for financial independence with detailed goal modeling:

- **FI Goals** — Set a target retirement age, track current and projected expenses, configure inflation and safe withdrawal rates, and monitor progress toward your FI number.
- **Withdrawal Goals** — Create subordinate goals tied to a parent FI goal with specific disbursement ages, custom amounts, and separate savings pools.
- **Management** — Create, edit, rename, reorder, and bulk-delete goals. Solo page view with prev/next navigation. Multi-select with 10-second undo. Goal Mixer for bulk operations.

### Accounts & Balances

Track account balances month-over-month across any number of accounts:

- Create accounts with types and ownership (primary, partner, joint).
- Record monthly balances in a spreadsheet-style editor.
- Visualize historical trends and net worth growth with interactive charts.
- CSV import with custom column mapping, plus full JSON export.

### Budget

Import bank or credit card CSVs and categorize transactions:

- Organize categories into groups (Living, Investment, Utilities, etc.).
- View detailed transactions, aggregated summaries, bar charts, and Sankey flow diagrams.
- Multi-year support with monthly granularity.

### Allocation & Rebalancing

- View current asset allocation across all accounts.
- Apply preset strategies or build custom ratio targets.
- Tie allocation ratios to specific goals and adjust by age.

### Taxes

Year-based tax document organizer:

- Checklist items per owner (primary, partner, joint) with categories like paystubs, account statements, and tax returns.
- Upload PDFs and other documents directly — stored locally and synced to GitHub as individual files.
- Rename items, link accounts, and track completion.

### Drive

Hierarchical file browser for all uploaded documents:

- Budget CSVs organized by year/month.
- Tax documents organized by year and category.
- Drag-and-drop navigation with CSV preview.

### Tools

- **FI Calculator** — Simulate retirement readiness with configurable growth rates, inflation, and historical return assumptions.
- **Savings/Growth Tracker** — Break down net worth changes into savings contributions vs. capital gains. Year-over-year analysis with editable income data.
- **PDF to CSV** *(Labs)* — Extract transaction tables from bank PDFs with smart column detection.

### Settings

- **Profile** — Name, birthday, avatar, and optional partner profile for joint planning.
- **Appearance** — Dark/light mode with 9 accent color themes applied globally.
- **GitHub Sync** — Encrypted backup to a private GitHub repo (AES-256 with PBKDF2). Auto-sync with 60-second debounce, manual sync, commit history, and point-in-time restore.
- **Advanced** — Data export/import, CSV import toggle, factory reset.
- **Labs** — Toggle experimental features like PDF-to-CSV.

## Privacy & Security

- **No server, no account.** All data lives in your browser's localStorage.
- **GitHub tokens are encrypted** at rest with a passphrase using AES-256-GCM + PBKDF2. Tokens are only decrypted in memory for the current session.
- **No telemetry or analytics.** The app is a static site deployed to GitHub Pages.

## Tech Stack

- React 18 + TypeScript
- React Router 7
- Recharts (charts)
- PDF.js (PDF parsing)
- Vite (build)
- GitHub Pages (deploy)

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for project structure and development details.

## License

See [LICENSE](LICENSE) for details.
