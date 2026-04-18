---
name: add-tests
description: 'Add comprehensive tests to React components, hooks, and utilities. Use when: writing tests, adding test coverage, testing user flows, testing edge cases, setting up Vitest or Playwright.'
argument-hint: 'Specify what to test, e.g. "Goal page", "useProfile hook", or "full audit"'
---

# Add Tests

## When to Use

- Adding tests for a component, hook, or utility
- Auditing test coverage and filling gaps
- Setting up the test infrastructure from scratch
- Testing a specific user flow end-to-end

## Stack

- **Unit / Component / Integration**: Vitest + React Testing Library + jsdom
- **E2E**: Playwright
- **Mocking**: Mock Service Worker (msw) for API calls, `vi.mock()` for modules
- **Test location**: sibling `.test.ts` / `.test.tsx` files alongside the source file

## Setup (First Time Only)

If the project has no test dependencies installed yet, run this setup:

### Install dependencies

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
npm install -D @playwright/test
npx playwright install
```

### Configure Vitest

Add to `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

### Create test setup file

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

### Add test script to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

### Configure Playwright

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
})
```

### Verify setup

Create a smoke test at `src/App.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'

describe('setup', () => {
  it('works', () => {
    expect(true).toBe(true)
  })
})
```

Run `npm test` to confirm.

## Procedure

### 1. Analyze Before Writing

Before writing any tests, read the target code and identify:
- **Critical user flows**: what does the user actually do? (click, type, navigate)
- **Risky logic**: complex calculations, conditional branches, state machines
- **Edge cases**: empty states, null/undefined inputs, boundary values, error conditions
- **Missing validation**: inputs that could break if unchecked

Document these as comments at the top of the test file.

### 2. Test Hierarchy

Apply tests in this order of priority:

| Layer | What to test | Tools |
|-------|-------------|-------|
| **Unit** | Pure functions, utilities, calculations, formatters | `vitest`, `expect` |
| **Component** | Rendering, user interaction, conditional UI, a11y | `@testing-library/react`, `userEvent` |
| **Integration** | Multi-component flows, API → state → UI | RTL + msw |
| **E2E** | Critical user journeys only | Playwright |

### 3. Unit Tests

For utility functions and pure logic:

```ts
import { describe, it, expect } from 'vitest'
import { calculateGoalMetrics } from '../utils/goalCalculations'

describe('calculateGoalMetrics', () => {
  it('returns zero progress for a new goal with no savings', () => {
    // ...
  })

  it('handles null/undefined inputs gracefully', () => {
    // ...
  })

  it('clamps progress to 100% when overfunded', () => {
    // ...
  })
})
```

Rules:
- Cover happy path, edge cases, invalid inputs, boundary conditions
- One assertion per concept (multiple `expect` calls are fine if testing the same behavior)
- Test names must describe **behavior**, not implementation: "returns 0 when..." not "tests the if branch"

### 4. Component Tests

Use React Testing Library — query by what the user sees:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('GoalMiniCard', () => {
  it('renders the goal name and target amount', () => {
    render(<GoalMiniCard goal={mockGoal} />)
    expect(screen.getByText('Retirement')).toBeInTheDocument()
    expect(screen.getByText('$1,000,000')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    render(<GoalMiniCard goal={mockGoal} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockGoal.id)
  })
})
```

Rules:
- Query by role, label, or text — never by CSS class or test ID unless no semantic alternative exists
- Test what the user sees and does, not internal state
- Test conditional rendering (loading, empty, error states)
- Validate accessibility: roles, aria-labels, keyboard navigation

### 5. Integration Tests

Test realistic flows with mocked APIs:

```tsx
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.get('/api/goals', () => HttpResponse.json(mockGoals))
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

it('loads goals and displays them in the list', async () => {
  render(<GoalPage />)
  expect(await screen.findByText('Retirement')).toBeInTheDocument()
})

it('shows error message when API fails', async () => {
  server.use(http.get('/api/goals', () => HttpResponse.error()))
  render(<GoalPage />)
  expect(await screen.findByText(/failed to load/i)).toBeInTheDocument()
})
```

### 6. E2E Tests (Playwright)

Only for critical user journeys:

```ts
import { test, expect } from '@playwright/test'

test('user can create a new goal', async ({ page }) => {
  await page.goto('/')
  await page.click('text=Goals')
  await page.click('text=+ New Goal')
  await page.fill('[aria-label="Goal name"]', 'Emergency Fund')
  await page.click('text=Save')
  await expect(page.locator('text=Emergency Fund')).toBeVisible()
})
```

Rules:
- Only high-value flows: goal CRUD, data import/export, settings changes
- Use stable locators (text, role, aria-label) — not CSS selectors
- Keep tests independent — each test starts from a clean state

### 7. Edge Cases Checklist

Always test these for every component/function:

- [ ] Empty/null/undefined inputs
- [ ] Empty collections (no goals, no accounts, no data)
- [ ] Loading states (spinner, skeleton)
- [ ] Error states (network failure, invalid data)
- [ ] Boundary values (0, negative numbers, very large numbers)
- [ ] User cancellation (close modal, navigate away)
- [ ] Rapid interactions (double-click, fast typing)

### 8. What NOT to Test

- CSS styling or layout (use visual regression tools instead)
- Third-party library internals
- Implementation details (internal state, private methods, hook internals)
- Trivial pass-through components with no logic

### 9. Test Quality Rules

- **No duplication**: extract shared setup into `beforeEach` or factory functions
- **Descriptive names**: `it('disables submit button when form is invalid')` not `it('test 1')`
- **Arrange-Act-Assert**: clear separation in every test
- **No test interdependence**: each test must pass in isolation
- **Clean up**: unmount components, reset mocks, restore timers

### 10. Output Format

For each file tested, create a sibling test file:
- `src/pages/goal/utils/goalCalculations.ts` → `src/pages/goal/utils/goalCalculations.test.ts`
- `src/pages/goal/components/GoalMiniCard.tsx` → `src/pages/goal/components/GoalMiniCard.test.tsx`

At the end, summarize:
- What scenarios are covered
- What gaps remain and why (e.g., "localStorage mocking needed for theme tests")
