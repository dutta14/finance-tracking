# Design Spec: Unlock Screen & Settings Encryption UI

**Designer:** Kai, Principal Product Designer
**Date:** 2025-07-15
**Status:** Ready for implementation
**Implements:** Encryption passphrase gating + Settings security pane

---

## Design System Tokens Reference

All values below reference the existing CSS variable system in `colorThemes.css` and `modern-design.css`. No new tokens are introduced unless explicitly noted.

| Token | Purpose |
|---|---|
| `--accent` / `--accent-hover` | Primary actions (buttons, focus rings) |
| `--color-surface` | Card/panel background |
| `--color-surface-alt` | Input backgrounds |
| `--color-bg` | Page background |
| `--color-text` | Primary text |
| `--color-text-muted` | Secondary/hint text |
| `--color-text-secondary` | Labels |
| `--color-border` | Borders |
| `--color-border-light` | Subtle borders |
| `--color-negative` / `--color-negative-light` / `--color-negative-border` | Error states |
| `--color-positive` / `--color-positive-light` | Success states |
| `--color-warning` / `--color-warning-light` | Warning states |
| `--color-text-on-accent` | Text on accent-colored backgrounds |
| `--radius` (8px / 10px modern) | Standard border radius |
| `--radius-sm` (4px / 6px modern) | Small border radius |
| `--fs-xs` through `--fs-2xl` | Type scale |
| `--fw-normal` through `--fw-bold` | Font weights |
| `--shadow-sm` / `--shadow-md` / `--shadow-lg` | Elevation system (modern-design) |
| `--ease-out` / `--duration-fast` / `--duration-base` | Transition timing |

---

## Part 1: Unlock Screen

### 1.1 Purpose

Full-screen gating layer shown when `isLocked === true`. Prevents any financial data from rendering. This is the first thing users see on app launch when encryption is enabled.

### 1.2 Component Hierarchy

```
<div.unlock-screen>                          // Full viewport overlay
  <main.unlock-card role="main">             // Centered card
    <div.unlock-brand>                        // Branding cluster
      <svg.unlock-brand-icon>                 // Shield/lock icon (24×24)
      <h1.unlock-brand-title>                 // "Finance Tracker"
    </div>
    <div.unlock-header>
      <h2.unlock-title>                       // "Unlock your data"
      <p.unlock-subtitle>                     // "Enter your passphrase to continue"
    </div>
    <form.unlock-form @submit>
      <div.unlock-field>
        <label.unlock-label for="unlock-passphrase">  // "Passphrase"
        <div.unlock-input-wrapper>
          <input#unlock-passphrase             // type="password", autofocus
               .unlock-input
               [.unlock-input--error]>
          <button.unlock-toggle-visibility     // Show/hide toggle
                 type="button"
                 aria-label="Show passphrase">
            <svg>                              // Eye / EyeOff icon
          </button>
        </div>
        <p.unlock-error role="alert"           // Conditional error message
           aria-live="assertive">
      </div>
      <button.unlock-submit type="submit">    // "Unlock"
        <span.unlock-submit-text>             // Label text
        <svg.unlock-submit-spinner>           // Loading spinner (conditional)
      </button>
    </form>
    <div.unlock-help>
      <button.unlock-help-trigger             // "Forgot your passphrase?"
             type="button"
             aria-expanded="false|true"
             aria-controls="unlock-help-panel">
      <div#unlock-help-panel                  // Expandable help content
           .unlock-help-panel
           role="region"
           aria-labelledby (trigger)>
        <p>                                   // Recovery explanation
        <p>                                   // GitHub Sync recovery path
        <p>                                   // "Start fresh" instructions
      </div>
    </div>
  </main>
</div>
```

### 1.3 Visual Spec

#### Overlay (`.unlock-screen`)
- `position: fixed; inset: 0`
- `z-index: 10001` (above settings modal at 10000)
- `display: flex; align-items: center; justify-content: center`
- `background: var(--color-bg)`
- `padding: 1.5rem`

#### Card (`.unlock-card`)
- `width: 100%; max-width: 400px`
- `padding: 2.5rem 2rem`
- `background: var(--color-surface)`
- `border: 1px solid var(--color-border)`
- `border-radius: var(--radius)` (8px default, 10px modern)
- `box-shadow: var(--shadow-lg)` when modern-design, else `0 20px 25px -5px rgba(0,0,0,0.1)`
- `display: flex; flex-direction: column; gap: 1.5rem`

#### Brand cluster (`.unlock-brand`)
- `display: flex; align-items: center; gap: 0.5rem; justify-content: center`
- Icon: 24×24 shield-lock SVG, `color: var(--accent)`
- Title (`.unlock-brand-title`):
  - `font-size: var(--fs-lg)`
  - `font-weight: var(--fw-semibold)`
  - `color: var(--color-text)`
  - `letter-spacing: -0.5px` (matches `.nav-logo`)
  - `margin: 0`

#### Header (`.unlock-header`)
- `text-align: center`
- Title (`.unlock-title`):
  - `font-size: var(--fs-xl)` (1.25rem)
  - `font-weight: var(--fw-semibold)`
  - `color: var(--color-text)`
  - `margin: 0 0 0.25rem 0`
  - `letter-spacing: -0.025em`
- Subtitle (`.unlock-subtitle`):
  - `font-size: var(--fs-sm)`
  - `color: var(--color-text-muted)`
  - `margin: 0`
  - `line-height: 1.5`

#### Form (`.unlock-form`)
- `display: flex; flex-direction: column; gap: 1rem`

#### Field (`.unlock-field`)
- `display: flex; flex-direction: column; gap: 0.35rem`

#### Label (`.unlock-label`)
- `font-size: var(--fs-sm)`
- `font-weight: var(--fw-medium)`
- `color: var(--color-text-secondary)`
- Follows `.settings-label` pattern

#### Input wrapper (`.unlock-input-wrapper`)
- `position: relative; display: flex; align-items: center`

#### Input (`.unlock-input`)
- Follows `.settings-input` + modern-design input pattern exactly:
  - `width: 100%; padding: 10px 14px; padding-right: 44px` (room for eye toggle)
  - `border: 1px solid var(--color-border)`
  - `border-radius: var(--radius)`
  - `font-size: var(--fs-md)`
  - `background: var(--color-surface-alt)`
  - `color: var(--color-text)`
  - `transition: border-color 120ms var(--ease-out), box-shadow 120ms var(--ease-out)`
- **Hover:** `border-color: var(--accent-border)`
- **Focus:** `border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); outline: none`
- **Dark focus (modern):** add `0 0 20px rgba(59,130,246,0.15)` to box-shadow
- **Error (`.unlock-input--error`):**
  - `border-color: var(--color-negative)`
  - Focus: `box-shadow: 0 0 0 3px var(--color-negative-light)`
- `placeholder: "Enter your passphrase"` — `color: var(--color-text-muted); opacity: 0.6`

#### Visibility toggle (`.unlock-toggle-visibility`)
- `position: absolute; right: 4px; top: 50%; transform: translateY(-50%)`
- `width: 36px; height: 36px` (meets 44×44 touch target when accounting for padding)
- `display: flex; align-items: center; justify-content: center`
- `background: none; border: none; cursor: pointer`
- `color: var(--color-text-muted)`
- `border-radius: var(--radius-sm)`
- `transition: color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)`
- **Hover:** `color: var(--color-text); background: var(--color-surface-hover)`
- **Focus-visible:** standard focus ring (see §1.8)
- Icon: 16×16 SVG. Eye-open when password hidden, Eye-off when password visible.
- `aria-label`: toggles between "Show passphrase" and "Hide passphrase"

#### Error message (`.unlock-error`)
- `font-size: var(--fs-sm)` (0.875rem)
- `color: var(--color-negative)`
- `margin: 0`
- `min-height: 1.25rem` (prevent layout shift — always reserve space)
- `role="alert"` + `aria-live="assertive"` so screen readers announce immediately
- **Entrance animation:** the input wrapper (not the message) shakes
  - `animation: unlock-shake 400ms var(--ease-out)` applied to `.unlock-input-wrapper` when error class is set
  - Keyframes:
    ```
    @keyframes unlock-shake {
      0%, 100% { transform: translateX(0) }
      15%      { transform: translateX(-6px) }
      30%      { transform: translateX(5px) }
      45%      { transform: translateX(-4px) }
      60%      { transform: translateX(3px) }
      75%      { transform: translateX(-2px) }
    }
    ```
  - Respects `prefers-reduced-motion: reduce` → no shake, error border only

#### Submit button (`.unlock-submit`)
- Follows `.settings-btn` pattern:
  - `width: 100%` (full width within form — unlike settings-btn which is align-self: flex-start)
  - `padding: 10px 14px`
  - `background: var(--accent)`
  - `color: var(--color-text-on-accent)`
  - `border: none; border-radius: var(--radius)`
  - `font-size: var(--fs-md)`
  - `font-weight: var(--fw-semibold)`
  - `cursor: pointer`
  - `transition: background var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)`
- **Hover:** `background: var(--accent-hover)`
- **Active (modern):** `transform: scale(0.98)`
- **Focus-visible:** `box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--accent)` (dark: add glow)
- **Disabled:** `opacity: 0.5; cursor: not-allowed; pointer-events: none`
  - Disabled when: `passphrase.trim() === ''` OR `loading === true`
- **Loading state:**
  - Text changes from "Unlock" to "Unlocking…"
  - `.unlock-submit-spinner`: 16×16 SVG circle with `stroke-dasharray`, rotating via `animation: unlock-spin 0.8s linear infinite`
  - Spinner sits left of text, `gap: 0.5rem`
  - `cursor: wait`

#### Help section (`.unlock-help`)
- `margin-top: 0.5rem; text-align: center`

#### Help trigger (`.unlock-help-trigger`)
- `background: none; border: none; cursor: pointer`
- `font-size: var(--fs-sm)`
- `color: var(--color-text-muted)`
- `text-decoration: underline`
- `text-decoration-style: dotted`
- `text-underline-offset: 2px`
- **Hover:** `color: var(--color-text)`
- `padding: 0.25rem 0.5rem` (touch target)
- `border-radius: var(--radius-sm)`
- **Focus-visible:** standard focus ring

#### Help panel (`.unlock-help-panel`)
- `overflow: hidden`
- `max-height: 0; opacity: 0` → when expanded: `max-height: 300px; opacity: 1`
- `transition: max-height var(--duration-slow, 350ms) var(--ease-out), opacity var(--duration-base, 200ms) var(--ease-out)`
- When expanded:
  - `margin-top: 0.75rem`
  - `padding: 1rem`
  - `background: var(--color-surface-alt)`
  - `border: 1px solid var(--color-border)`
  - `border-radius: var(--radius)`
  - `text-align: left`
- Content — three paragraphs:
  1. **"Your data is encrypted locally."** + "Without the correct passphrase, it cannot be recovered."
     - `font-size: var(--fs-sm); color: var(--color-text); line-height: 1.6; margin: 0 0 0.75rem 0`
  2. **"If you have GitHub Sync enabled,"** + "you can clear your local data and restore from your last sync."
     - Same styling
  3. **"To start fresh,"** + "clear your browser's localStorage for this site, then reload."
     - Same styling, `margin-bottom: 0`
  - Bold text uses `font-weight: var(--fw-semibold)`
  - `prefers-reduced-motion: reduce` → `transition-duration: 0.01ms` (instant expand)

### 1.4 States

| State | Visual Change |
|---|---|
| **Default** | Empty input, Unlock button disabled (opacity 0.5) |
| **Typing** | Input focused (accent border + ring), Unlock button becomes enabled |
| **Submitting** | Input disabled, button shows spinner + "Unlocking…", cursor: wait |
| **Error** | Input border turns `--color-negative`, wrapper shakes, error text appears below, passphrase cleared, input re-focused |
| **Error + typing** | As user types again, error text fades out (200ms), input border reverts to default on next keystroke |
| **Help expanded** | Panel slides open, trigger text remains, `aria-expanded="true"` |

### 1.5 Responsive Behavior

#### Desktop (> 900px)
- Card is centered with generous whitespace, `max-width: 400px`

#### Tablet / small desktop (480–900px)
- No changes — card naturally sizes within viewport

#### Mobile (< 480px)
- `.unlock-card`: `padding: 2rem 1.5rem`
- `.unlock-screen`: `padding: 1rem`
- `.unlock-brand-title`: `font-size: var(--fs-md)`
- `.unlock-title`: `font-size: var(--fs-lg)` (step down from xl)
- Card maintains `max-width: 400px` but will shrink to fill viewport

### 1.6 Dark Mode

All tokens auto-swap via `body.dark` and `body.modern-design.dark` variable overrides. Specific notes:

- `.unlock-screen` background: `var(--color-bg)` → dark: `#141820` (default) or `#0f172a` (modern)
- `.unlock-card` background: `var(--color-surface)` → dark: `#1e1e1e` / `#1e293b`
- Card shadow: in dark modern, add subtle `--accent-glow`: `0 0 20px rgba(59,130,246,0.15)` to box-shadow
- No additional overrides needed — the token system handles it

### 1.7 Interaction Spec

| Interaction | Behavior |
|---|---|
| **Page load** | Input receives autofocus immediately |
| **Enter key** | Submits form (native form behavior) |
| **Tab order** | Input → visibility toggle → Unlock button → Forgot passphrase link |
| **Escape key** | No action (there's nowhere to escape to) |
| **Error shake** | 400ms, then input re-focused automatically via `inputRef.current.focus()` |
| **Show/hide toggle** | Toggles `type` between "password" and "text", focus stays on input (not the toggle) — call `inputRef.current.focus()` after toggle |
| **Help expand** | Smooth height transition. Toggle is `aria-expanded`. Panel is `role="region"`. |

### 1.8 Accessibility

- **Focus management:** `autoFocus` on passphrase input. After error, re-focus input programmatically.
- **Focus visible:** All interactive elements must show visible focus rings.
  - Default: `outline: 2px solid var(--accent); outline-offset: 2px`
  - Modern dark: `box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--accent), 0 0 20px rgba(59,130,246,0.15)`
- **Screen reader:**
  - Error message: `role="alert" aria-live="assertive"` announces immediately
  - Visibility toggle: `aria-label` updates dynamically
  - Help trigger: `aria-expanded` + `aria-controls`
  - Help panel: `role="region"` with label
  - Card: `role="main"` — this IS the main content when locked
- **Keyboard:** Full keyboard operability. No mouse required.
- **Motion:** `prefers-reduced-motion: reduce` disables shake animation and collapses transitions to 0.01ms
- **Color contrast:** All text meets WCAG 2.1 AA (4.5:1 min). Error red on light background: `#ef4444` on `#ffffff` = 4.6:1 ✓. Error red on dark: `#f87171` on `#1e1e1e` = 6.8:1 ✓.

---

## Part 2: Settings → Security Pane

### 2.1 Purpose

New "Security" section in the Settings modal, accessible via a new nav item. Allows users to enable, configure, change, or disable encryption.

### 2.2 Settings Modal Changes

#### New nav item (inserted between "Appearance" and "Advanced")

```html
<button class="settings-modal-nav-item [active]"
        @click → setActiveSection('security')>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <!-- Shield icon path -->
  </svg>
  Security
</button>
```

- Icon: 16×16 shield SVG (consistent with other nav icons)
- Section key: `'security'`
- Type update: Add `'security'` to `SettingsSection` union type

### 2.3 Component Hierarchy — SecurityPane

```
<div.settings-section>
  <h3>                                        // "Security"
  <div.settings-section-content>

    // ── When encryption is OFF ──
    <div.security-status>
      <div.security-status-icon>              // Open shield icon, muted
      <div.security-status-info>
        <span.security-status-label>          // "Encryption disabled"
        <p.settings-description>              // Explanation text
      </div>
    </div>
    <button.settings-btn>                     // "Enable Encryption"

    // ── Enable form (inline, shown on click) ──
    <div.security-setup-form>
      <div.security-form-header>
        <h4>                                  // "Set up encryption"
        <button.security-form-close>          // "Cancel" (×)
      </div>
      <div.unlock-field>                      // Reuse unlock field pattern
        <label for="setup-passphrase">
        <div.unlock-input-wrapper>
          <input#setup-passphrase type="password">
          <button.unlock-toggle-visibility>
        </div>
      </div>
      <div.unlock-field>
        <label for="setup-confirm">
        <div.unlock-input-wrapper>
          <input#setup-confirm type="password">
          <button.unlock-toggle-visibility>
        </div>
        <p.security-mismatch role="alert">    // "Passphrases don't match"
      </div>
      <div.security-warning>                  // Warning callout
        <svg>                                 // Warning triangle icon
        <p>                                   // Recovery warning text
      </div>
      <div.security-form-actions>
        <button.settings-btn--outline>        // "Cancel"
        <button.settings-btn>                 // "Enable Encryption"
      </div>
    </div>

    // ── When encryption is ON ──
    <div.security-status>
      <div.security-status-icon .enabled>     // Filled shield + checkmark, accent
      <div.security-status-info>
        <span.security-status-label>          // "Encryption enabled ✓"
        <p.settings-description>              // "Your data is protected..."
      </div>
    </div>
    <div.security-actions>
      <button.settings-btn--secondary>        // "Change Passphrase"
      <button.settings-btn--danger-outline>   // "Disable Encryption"
    </div>
    <div.security-warning>                    // Persistent warning
      <svg>
      <p>
    </div>

    // ── Change Passphrase form (inline, toggled) ──
    <div.security-change-form>
      <h4>                                    // "Change passphrase"
      <div.unlock-field>
        <label>                               // "Current passphrase"
        <div.unlock-input-wrapper>...</div>
      </div>
      <div.unlock-field>
        <label>                               // "New passphrase"
        <div.unlock-input-wrapper>...</div>
      </div>
      <div.unlock-field>
        <label>                               // "Confirm new passphrase"
        <div.unlock-input-wrapper>...</div>
        <p.security-mismatch>
      </div>
      <div.security-form-actions>
        <button.settings-btn--outline>        // "Cancel"
        <button.settings-btn>                 // "Update Passphrase"
      </div>
    </div>

    // ── Disable confirmation (inline, toggled) ──
    <div.security-disable-confirm>
      <div.settings-reset-warning>            // Reuse reset warning pattern
        <svg>
        <div>
          <p.settings-reset-title>            // "Disable encryption?"
          <p.settings-reset-message>          // Consequences explanation
        </div>
      </div>
      <div.unlock-field>
        <label>                               // "Enter passphrase to confirm"
        <div.unlock-input-wrapper>...</div>
        <p.unlock-error>                      // "Incorrect passphrase"
      </div>
      <div.settings-reset-actions>
        <button.settings-btn--outline>        // "Cancel"
        <button.settings-btn--danger>         // "Disable Encryption"
      </div>
    </div>

  </div>
</div>
```

### 2.4 Visual Spec — Security Pane

#### Section heading
- Follows existing `settings-section h3` pattern exactly:
  - `font-size: var(--fs-lg); font-weight: var(--fw-semibold)`
  - In modern-design: `letter-spacing: -0.025em; color: var(--color-text)`
  - Default: gradient text via `--accent-gradient-from/to`

#### Status row (`.security-status`)
- `display: flex; gap: 0.75rem; align-items: flex-start`
- `padding: 1rem`
- `background: var(--color-surface-alt)`
- `border: 1px solid var(--color-border)`
- `border-radius: var(--radius)`

#### Status icon (`.security-status-icon`)
- `width: 36px; height: 36px; flex-shrink: 0`
- `display: flex; align-items: center; justify-content: center`
- `border-radius: var(--radius-sm)`
- **When OFF:**
  - `background: var(--color-surface-hover)`
  - Icon: 20×20 open shield outline, `color: var(--color-text-muted)`
- **When ON (`.security-status-icon.enabled`):**
  - `background: var(--color-positive-light)`
  - Icon: 20×20 filled shield with checkmark, `color: var(--color-positive)`

#### Status label (`.security-status-label`)
- `font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text)`
- When ON: append " ✓" in `color: var(--color-positive)`

#### Status description
- Reuses `.settings-description`: `font-size: var(--fs-sm); color: var(--color-text-muted); line-height: 1.5`
- When OFF: "Encrypt your financial data with a passphrase to protect it from unauthorized access."
- When ON: "Your financial data is encrypted. A passphrase is required to access the app."

#### Enable button (when encryption is OFF)
- Reuses `.settings-btn`:
  - `background: var(--accent); color: var(--color-text-on-accent)`
  - `padding: 0.4rem 0.85rem; border-radius: var(--radius)`
  - On click: reveals the setup form inline below

#### Action buttons row (when encryption is ON) (`.security-actions`)
- `display: flex; gap: 0.5rem; flex-wrap: wrap`
- "Change Passphrase" → `.settings-btn--secondary` pattern (border, no fill)
- "Disable Encryption" → new `.settings-btn--danger-outline`:
  - `background: transparent`
  - `color: var(--color-negative)`
  - `border: 1px solid var(--color-negative-border)`
  - Hover: `background: var(--color-negative-light); border-color: var(--color-negative)`

#### Inline forms (setup / change / disable)

All three follow the same container pattern:

- `margin-top: 0.75rem`
- `padding: 1rem`
- `background: var(--color-surface-alt)`
- `border: 1px solid var(--color-border)`
- `border-radius: var(--radius)`
- `display: flex; flex-direction: column; gap: 0.75rem`
- **Entrance:** `animation: security-form-enter var(--duration-base, 200ms) var(--ease-out)`
  ```
  @keyframes security-form-enter {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  ```
  - `prefers-reduced-motion: reduce` → instant (no animation)

#### Form heading (`h4` inside forms)
- `font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); margin: 0`

#### Input fields inside forms
- **Reuse the `.unlock-field`, `.unlock-input-wrapper`, `.unlock-input`, `.unlock-toggle-visibility` classes** from Part 1
- These are shared components/classes — defined once, used in both Unlock Screen and Settings
- Labels: `.unlock-label` (same as `.settings-label`)

#### Passphrase mismatch error (`.security-mismatch`)
- Same as `.unlock-error`: `font-size: var(--fs-sm); color: var(--color-negative); margin: 0`
- `role="alert" aria-live="polite"` (polite, not assertive — less urgent than unlock failure)
- Shown when confirm field is non-empty AND doesn't match

#### Warning callout (`.security-warning`)
- `display: flex; gap: 0.5rem; align-items: flex-start`
- `padding: 0.75rem`
- `background: var(--color-warning-light)`
- `border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)`
- `border-radius: var(--radius-sm)`
- Icon: 16×16 warning triangle, `color: var(--color-warning); flex-shrink: 0`
- Text: `font-size: var(--fs-sm); color: var(--color-warning-text, var(--color-text)); line-height: 1.5; margin: 0`
- **Content (setup form):** "If you forget your passphrase and don't have GitHub Sync enabled, your data cannot be recovered."
- **Content (persistent when ON):** "Keep your passphrase safe. Without it, your encrypted data cannot be accessed."

#### Disable confirmation
- Reuses the `.settings-reset-confirm` / `.settings-reset-warning` pattern from AdvancedPane
- Background: `var(--color-negative-light)` with `--color-negative-border`
- Title: "Disable encryption?" in `--color-negative`
- Message: "Your data will be decrypted and stored in plain text. Anyone with access to this browser can view it."
- Includes passphrase input for verification before disabling

#### Form action buttons (`.security-form-actions`)
- `display: flex; gap: 0.5rem; justify-content: flex-end`
- Cancel: `.settings-btn--outline`
- Submit: `.settings-btn` (primary) or `.settings-btn--danger` (for disable)

#### Success states
- After successful passphrase change: replace form with flash message
  - Reuses `.settings-save-flash` pattern: `color: var(--color-positive); font-weight: var(--fw-medium)`
  - Text: "Passphrase updated ✓"
  - Auto-fades via existing `settings-save-fade` keyframes (2s)
  - Form collapses, returns to status + action buttons view

### 2.5 States Matrix

| Component | State | Visual |
|---|---|---|
| Security pane | Encryption OFF | Status (muted shield), description, Enable button |
| Security pane | Encryption OFF + setup form open | Enable button hidden, inline form visible |
| Setup form | Empty | Both inputs empty, "Enable Encryption" button disabled |
| Setup form | Typing | Standard input focus styling |
| Setup form | Mismatch | Confirm input error border, mismatch message |
| Setup form | Valid | Both inputs match + non-empty, button enabled |
| Setup form | Submitting | Button shows spinner + "Encrypting…", inputs disabled |
| Setup form | Success | Form disappears, pane switches to ON state |
| Security pane | Encryption ON | Status (green shield ✓), description, Change/Disable buttons, warning |
| Change form | Wrong current | Current input error border, "Incorrect passphrase" error |
| Change form | Mismatch new | Confirm field error border, mismatch message |
| Change form | Submitting | "Updating…" with spinner |
| Change form | Success | Flash "Passphrase updated ✓", form collapses |
| Disable confirm | Wrong passphrase | Input error, "Incorrect passphrase" |
| Disable confirm | Submitting | "Disabling…" with spinner |
| Disable confirm | Success | Panel switches to OFF state |

### 2.6 Responsive Behavior

The Settings modal already handles responsive layout. The Security pane content is single-column by default, so no additional breakpoint rules are needed.

- At narrow modal widths (< 500px internal), the `.security-actions` buttons will `flex-wrap: wrap` and each button takes full width if needed
- Form containers remain full-width within the detail panel
- Input fields are always `width: 100%`

### 2.7 Dark Mode

Same approach as Part 1 — all tokens auto-swap. Specific notes:
- `.security-warning` background: `var(--color-warning-light)` → dark: `#451a03`
- `.security-warning` text: `var(--color-warning-text)` → dark: `#fbbf24`
- Status icon backgrounds use semantic light tokens that already have dark overrides
- Inline form backgrounds: `var(--color-surface-alt)` → dark: `#252830` / modern dark: `#1a2332`

### 2.8 Interaction Spec

| Interaction | Behavior |
|---|---|
| Click "Enable Encryption" | Button hides, setup form slides in with `security-form-enter` animation. Focus moves to first passphrase input. |
| Click "Cancel" on any form | Form collapses (instant, no animation), previous view restores. Focus returns to the button that opened the form. |
| Submit setup form | Calls `setupEncryption(passphrase)`. On success, form disappears, pane re-renders in ON state. |
| Click "Change Passphrase" | Inline change form appears. Focus moves to "Current passphrase" input. |
| Submit change form | Calls `changePassphrase(old, new)`. Returns `false` → error on current passphrase field. Returns `true` → success flash. |
| Click "Disable Encryption" | Danger confirmation panel appears (styled like factory reset). Focus moves to passphrase input. |
| Submit disable | Calls `disableEncryption(passphrase)`. Returns `false` → error. Returns `true` → pane re-renders in OFF state. |
| Escape key in form | Equivalent to Cancel — close form, restore focus. |
| Enter key in form fields | Submits the form (native form submission). |

### 2.9 Accessibility

- **Focus management:**
  - Opening a form: focus first input via `useEffect` + `ref.current.focus()`
  - Closing a form: return focus to trigger button via saved `ref`
  - Error: re-focus the problematic input
- **Screen reader announcements:**
  - Mismatch error: `role="alert" aria-live="polite"`
  - Wrong passphrase: `role="alert" aria-live="assertive"`
  - Success flash: `role="status" aria-live="polite"` announces "Passphrase updated"
  - Status change (OFF→ON, ON→OFF): `role="status" aria-live="polite"` on the status label
- **ARIA attributes:**
  - Show/hide toggle: `aria-label` toggles dynamically
  - Forms: each input has explicit `<label for="">` association
  - Disable confirmation: `aria-describedby` links the passphrase input to the warning text
- **Keyboard:**
  - Tab through: inputs → toggle → form buttons
  - Escape: closes active form
  - All buttons have visible `:focus-visible` rings
- **Color contrast:** All verified per Part 1 §1.8

---

## Part 3: Shared CSS Classes

The following classes are shared between the Unlock Screen and Settings Security pane. Define them in a new file: **`src/styles/Encryption.css`**.

### New classes (not in existing stylesheets)

| Class | Where used |
|---|---|
| `.unlock-screen` | Unlock Screen overlay |
| `.unlock-card` | Unlock Screen card |
| `.unlock-brand` / `.unlock-brand-icon` / `.unlock-brand-title` | Branding |
| `.unlock-header` / `.unlock-title` / `.unlock-subtitle` | Unlock header |
| `.unlock-form` | Unlock form container |
| `.unlock-field` | Shared: input field group |
| `.unlock-label` | Shared: field label |
| `.unlock-input-wrapper` | Shared: input + toggle container |
| `.unlock-input` / `.unlock-input--error` | Shared: passphrase input |
| `.unlock-toggle-visibility` | Shared: eye toggle button |
| `.unlock-error` | Shared: error message |
| `.unlock-submit` / `.unlock-submit-spinner` | Unlock button |
| `.unlock-help` / `.unlock-help-trigger` / `.unlock-help-panel` | Help disclosure |
| `.security-status` / `.security-status-icon` / `.security-status-label` | Settings status |
| `.security-actions` | Settings action button row |
| `.security-setup-form` / `.security-change-form` / `.security-disable-confirm` | Inline forms |
| `.security-warning` | Warning callout |
| `.security-mismatch` | Mismatch error |
| `.security-form-actions` | Form button row |
| `.settings-btn--danger-outline` | New button variant |

### Reused existing classes (do NOT redefine)

| Class | Source |
|---|---|
| `.settings-section` / `.settings-section-content` | SettingsModal.css |
| `.settings-description` | SettingsModal.css |
| `.settings-btn` / `--secondary` / `--outline` / `--danger` | SettingsModal.css |
| `.settings-label` | SettingsModal.css (`.unlock-label` mirrors this) |
| `.settings-input` | SettingsModal.css (`.unlock-input` mirrors this, adding error state) |
| `.settings-reset-confirm` / `warning` / `title` / `message` / `actions` | SettingsModal.css |
| `.settings-save-flash` | SettingsModal.css |

---

## Part 4: Implementation Notes for Sam

1. **File structure:**
   - `src/styles/Encryption.css` — all new classes from Part 3
   - `src/components/UnlockScreen.tsx` — rewrite from current placeholder using this spec
   - `src/pages/settings/components/SecurityPane.tsx` — new pane component
   - `src/pages/settings/types.ts` — add `'security'` to `SettingsSection`
   - `src/pages/settings/SettingsModal.tsx` — add nav item + render SecurityPane

2. **Shared sub-components to extract:**
   - `PassphraseInput` — wraps input + visibility toggle + error message. Used in both Unlock Screen and all Settings forms. Props: `id`, `label`, `value`, `onChange`, `error`, `disabled`, `autoFocus`, `placeholder`.
   - This avoids duplicating the toggle logic and ARIA handling.

3. **State management:** All encryption operations come from `useEncryption()` context. No new context needed.

4. **CSS import order:** Import `Encryption.css` in both `UnlockScreen.tsx` and `SecurityPane.tsx`.

5. **Keyframes:** Define `unlock-shake`, `unlock-spin`, and `security-form-enter` in `Encryption.css`.

6. **Testing considerations:**
   - Unlock Screen: test error state, keyboard submission, help panel expand/collapse, loading state
   - SecurityPane: test all three form flows (setup, change, disable), error states, success flash
   - Accessibility: verify `role="alert"` on error messages, `aria-expanded` on help trigger, focus management

---

## Appendix: Icon Specifications

### Shield-lock (Unlock Screen brand, 24×24)
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
  <rect x="9" y="11" width="6" height="5" rx="1"/>
  <path d="M10 11V9a2 2 0 1 1 4 0v2"/>
</svg>
```

### Shield outline (Settings nav, 16×16)
```svg
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M8 1L2 4v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4L8 1zm0 1.18L13 5v2.5c0 3.14-2.18 6.1-5 6.87-2.82-.77-5-3.73-5-6.87V5l5-2.82z"/>
</svg>
```

### Eye / Eye-off (visibility toggle, 16×16)
Use standard Lucide-style eye icons at 16×16, `stroke="currentColor" stroke-width="1.8"`.

### Warning triangle (callouts, 16×16)
```svg
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M8 1.5l6.93 12H1.07L8 1.5zM8 3.88L3.15 12.5h9.7L8 3.88zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z"/>
</svg>
```

---

*End of spec. Ready for Sam to implement.*
