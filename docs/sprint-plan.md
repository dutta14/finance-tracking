# Sprint Plan — Issues #39–63

**Created:** 2026-05-10
**Owner:** Rowan (Engineering Manager)
**Duration:** 10 weeks (5 sprints × 2 weeks)
**Status:** In Progress

---

## Team

| Person | Role | Specialization |
|--------|------|---------------|
| **Drew** | Sr. Infra Engineer | Refactoring, crypto, sync, upgrades |
| **Sam** | Staff Frontend Engineer | Component patterns, CSS, UI |
| **Mika** | Interaction Engineer | Gestures, forms, drag-drop, complex state |
| **River** | DataViz Engineer | Charts, SVG, calendar grids |
| **Finley** | DevOps Engineer | CI/CD, build, deployment |
| **Ellis** | Test Engineer | Unit tests (every issue) |
| **Quinn** | Quality Engineer | E2E tests + feature dev |

---

## Sprint 1: "Foundation" (Weeks 1–2)

**Theme:** Design polish + CI pipeline + quick wins
**Prerequisites:** None

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #39 | Template card `:active` state | XS | Sam | Ellis | — |
| #40 | Goal modal close affordance | S | Sam | Ellis | Quinn |
| #43 | `aria-expanded` for screen readers | XS | Sam | Ellis | Quinn |
| #42 | Staging env, E2E in CI, strip logs | M | Drew + Finley | Ellis | Quinn |
| #44 | Inline style consolidation (117→<30) | M | Drew + Sam | Ellis | Quinn |
| #63 | Dependabot config | XS | Finley | — | — |

**Capacity:** Sam 75%, Drew 60%, Finley 60%, Ellis 75%, Quinn 60%, River idle, Mika idle

**Notes:** #63 depends on #42 (CI pipeline). River and Mika use this sprint for design/research on #48 and #49.

### Execution Order

| Seq | Issue | Days | Dev | Blockers |
|-----|-------|------|-----|----------|
| 1 | #39 Template card `:active` state | Day 1 | Sam | — |
| 2 | #43 `aria-expanded` for screen readers | Day 1 | Sam | — |
| 3 | #40 Goal modal close affordance | Days 2–3 | Sam | #39, #43 |
| 4 | #42 Staging env, E2E in CI, strip logs | Days 1–4 | Drew + Finley | — |
| 5 | #63 Dependabot config | Day 5+ | Finley | #42 |
| 6 | #44 Inline style consolidation | Days 5–8 | Drew + Sam | #39, #43, #42 |

- Ellis writes unit tests alongside each feature as it lands
- Quinn writes E2E tests for #40, #43, #42, #44 after features land

---

## Sprint 2: "Coverage + Feature Kickoff" (Weeks 3–4)

**Theme:** Test coverage ramp + first features + E2E wave 1
**Prerequisites:** Sprint 1 complete (#42 CI pipeline live)

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #45 | Test coverage 40%→60% (72 files) | XL | Drew + Sam | Ellis | — |
| #48 | Projection Explorer chart | L | River | Ellis | Quinn |
| #49 | Mix & Match template options | L | Mika + Sam | Ellis | Quinn |
| #54 | E2E: Home Dashboard (20 cases) | M | — | — | Quinn |
| #55 | E2E: Goals (23 cases) | M | — | — | Quinn |

**Capacity:** Sam 100%, River 100%, Drew 75%, Mika 75%, Ellis 100%, Quinn 100%

**Notes:** #45 is XL — Tier 1 (Taxes.tsx, AccountsModal, useFocusTrap) must finish this sprint. Tier 2–3 overflow into Sprint 3.

---

## Sprint 3: "Leverage + Sync" (Weeks 5–6)

**Theme:** Leverage Planner v1 + sync conflicts + E2E wave 2
**Prerequisites:** Sprint 2 complete (#48, #49 landed; #45 Tier 1 done)

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #46 | Sync conflict detection/resolution | L | Drew | Ellis | — |
| #50 | Leverage Planner v1 (A/L ratio) | L | River + Mika | Ellis | Quinn |
| #56 | E2E: Goal Projections (16 cases) | M | — | — | Quinn |
| #57 | E2E: Net Worth (23 cases) | M | — | — | Quinn |
| #58 | E2E: Budget (25 cases) | L | — | — | Quinn |

**Capacity:** Drew 100%, River 100%, Mika 75%, Sam 60% (#45 overflow), Ellis 100%, Quinn 100%

**Notes:** #50 is the gate for #51 and #52. Must land by sprint end.

---

## Sprint 4: "Leverage Phase 2 + React Upgrade" (Weeks 7–8)

**Theme:** Leverage extensions + major dependency upgrade
**Prerequisites:** #50 landed (blocks #51, #52); #45 substantially complete

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #51 | A/L Ratio Trend Line Chart | M | River | Ellis | Quinn |
| #52 | Scenario Comparison (up to 3) | L | River + Mika | Ellis | Quinn |
| #53 | React 18→19, Vite 4→6 | M | Drew | Ellis | Quinn |
| #59 | E2E: Taxes (22 cases) | M | — | — | Quinn |
| #60 | E2E: Drive & Settings (28 cases) | L | — | — | Quinn |

**Capacity:** Drew 100%, River 100%, Mika 75%, Sam 50% (#53 support), Ellis 100%, Quinn 100%, Finley 30% (#53 CI)

**Notes:** #53 scheduled after test coverage is high (safety net). River sequences #51 → #52 within sprint.

---

## Sprint 5: "Decomposition + Final E2E" (Weeks 9–10)

**Theme:** God-component refactor + E2E completion + stabilization
**Prerequisites:** #45 complete (coverage enables safe decomposition); #53 landed and stable

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #41 | Break up god-components (Taxes 1033L, AccountsModal 989L, useGitHubSync 831L) | L | Drew + Sam | Ellis | — |
| #61 | E2E: Navigation & Responsiveness (27 cases) | M | — | — | Quinn |
| #62 | E2E: Cross-page Integration (38 cases) | L | — | — | Quinn |

**Capacity:** Drew 100%, Sam 75%, Ellis 75%, Quinn 100%, River/Mika/Finley idle (buffer for bug fixes)

---

## Dependency Graph

```
Sprint 1                Sprint 2             Sprint 3             Sprint 4             Sprint 5
────────                ────────             ────────             ────────             ────────
#42 (CI) ──────────────────────────────────→ #63 (Dependabot)
#42 (CI) ──→ #54,#55 (E2E wave 1)
                        #45 (coverage) ──────────────────────────────────────────────→ #41 (decomp)
                        #48 (Projection)
                        #49 (Mix&Match)
                                             #50 (Leverage v1) ──→ #51 (A/L Trend)
                                             #50 (Leverage v1) ──→ #52 (Scenarios)
                                                                  #53 (React/Vite)
                                             #46 (Sync)
```

## Key Risks

1. **#45 (XL)** — test coverage is the largest item. Tiers 2–3 may overflow. Mitigated by scheduling #41 (which depends on coverage) in Sprint 5.
2. **#53 (React/Vite upgrade)** — breaking changes risk. Mitigated by scheduling after coverage is high + buffer from Sam and Finley.
3. **Quinn's E2E load** — Quinn has E2E work every sprint. Monitor for burnout. River/Mika can pick up E2E in Sprint 5 if needed.
4. **#50 as gate** — Leverage Planner v1 blocks two follow-up issues. Must land cleanly in Sprint 3.
