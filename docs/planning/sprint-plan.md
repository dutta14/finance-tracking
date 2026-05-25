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

## Sprint 2: "Coverage" (Weeks 3–4)

**Theme:** Test coverage 40%→90% — all hands on testing
**Prerequisites:** Sprint 1 complete (#42 CI pipeline live)

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #45 | Test coverage 40%→90% | XXL | Drew + Sam + Mika + River | Ellis | — |

**Capacity:** Drew 100%, Sam 100%, Mika 100%, River 100%, Ellis 100%, Quinn idle (prep for S3)

**Notes:** Everyone writes tests. No features, no distractions. Quinn uses this sprint to prep page objects and E2E infrastructure for Sprint 3.

---

## Sprint 3: "E2E" (Weeks 5–6)

**Theme:** Full Playwright E2E suite — all 9 suites consolidated
**Prerequisites:** Sprint 2 complete (90% unit coverage provides stable foundation)

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #54 | E2E: Home Dashboard (20 cases) | M | — | — | Quinn |
| #55 | E2E: Goals (23 cases) | M | — | — | Quinn |
| #56 | E2E: Goal Projections (16 cases) | M | — | — | Quinn |
| #57 | E2E: Net Worth (23 cases) | M | — | — | Quinn |
| #58 | E2E: Budget (25 cases) | L | — | — | Quinn |
| #59 | E2E: Taxes (22 cases) | M | — | — | Quinn |
| #60 | E2E: Drive & Settings (28 cases) | L | — | — | Quinn |
| #61 | E2E: Navigation & Responsiveness (27 cases) | M | — | — | Quinn |
| #62 | E2E: Cross-page Integration (38 cases) | L | — | — | Quinn |

**Capacity:** Quinn 100% (lead), Sam 50% (assist on feature-heavy suites), Mika 50% (assist)

**Notes:** Unit coverage from S2 makes E2E page objects easier. Sam and Mika assist on suites that require deep component knowledge.

---

## Sprint 4: "Features + Upgrade" (Weeks 7–8)

**Theme:** First real feature work + React/Vite upgrade (safe with 90% unit + full E2E)
**Prerequisites:** Sprint 3 complete (full test safety net in place)

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #48 | Projection Explorer chart | L | River | Ellis | Quinn |
| #49 | Mix & Match template options | L | Mika + Sam | Ellis | Quinn |
| #46 | Sync conflict detection/resolution | L | Drew | Ellis | — |
| #53 | React 18→19, Vite 4→6 | M | Drew + Finley | Ellis | Quinn |

**Capacity:** Drew 100%, Sam 75%, River 100%, Mika 75%, Ellis 100%, Quinn 50%, Finley 30%

**Notes:** No dependencies between these — all parallel. React upgrade is safe now with full test coverage.

---

## Sprint 5: "Leverage + Decomposition" (Weeks 9–10)

**Theme:** Leverage Planner suite + god-component refactor
**Prerequisites:** #50 gates #51/#52; #45 (90% coverage) enables safe decomposition

| Issue | Title | Size | Dev | Tests | E2E |
|-------|-------|------|-----|-------|-----|
| #50 | Leverage Planner v1 (A/L ratio) | L | River + Mika | Ellis | Quinn |
| #51 | A/L Ratio Trend Line Chart | M | River | Ellis | Quinn |
| #52 | Scenario Comparison (up to 3) | L | River + Mika | Ellis | Quinn |
| #41 | Break up god-components (Taxes 1033L, AccountsModal 989L, useGitHubSync 831L) | L | Drew + Sam | Ellis | — |

**Capacity:** Drew 100%, Sam 75%, River 100%, Mika 75%, Ellis 100%, Quinn 75%

**Notes:** #50 → #51 → #52 sequenced within sprint. #41 runs in parallel (no deps on Leverage).

---

## Dependency Graph

```
Sprint 1                Sprint 2             Sprint 3             Sprint 4             Sprint 5
────────                ────────             ────────             ────────             ────────
#42 (CI) ─────→ #45 (coverage 90%) ──→ #54-62 (all E2E) ──→ #48,#49,#46,#53 ──→ #50→#51→#52
                 #45 (coverage 90%) ──────────────────────────────────────────────→ #41 (decomp)
                                                                #53 (React/Vite)
                                                                                    #50→#51 (A/L)
                                                                                    #50→#52 (Scenarios)
```

## Key Risks

1. **#45 (XXL)** — 40%→90% is the largest item in the entire plan. Full sprint dedicated. Mitigated by all-hands staffing.
2. **S3 E2E volume** — 9 E2E suites in one sprint is heavy for Quinn. Mitigated by Sam + Mika assist.
3. **#53 (React/Vite upgrade)** — breaking changes risk. Mitigated by scheduling after 90% unit + full E2E coverage.
4. **#50 as gate** — Leverage Planner v1 blocks #51 and #52. Sequenced within Sprint 5.
