# Security Policy

## Security Model

Finance Tracking is a fully client-side React application hosted on GitHub Pages. There is no backend server, no database, and no server-side data collection.

- All financial data is stored as plain files in a folder the user chooses on their own disk, using the browser's File System Access API.
- The folder handle (not the files themselves) is persisted in IndexedDB so the browser can reconnect on the next visit.
- Small UI preferences (dark mode, accent theme, feature-flag seeds) stay in `localStorage`. No financial data lives there.
- The app has no application-level encryption. Data is as protected as the user's disk is. Users who need at-rest protection should use full-disk encryption at the OS level (FileVault, BitLocker, or equivalent).
- No cookies, analytics, or PII leave the browser. The app makes no outbound network requests for user data.

Your data never touches our servers because there are no servers.

## Supported Versions

This app is continuously deployed from `main`. Only the latest deployed version is supported with security fixes.

| Version | Supported |
| ------- | --------- |
| Latest (main) | ✅ |
| Older builds | ❌ |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting:

1. Go to [github.com/dutta14/finance-tracking/security](https://github.com/dutta14/finance-tracking/security)
2. Click **Report a vulnerability**
3. Describe the issue, steps to reproduce, and potential impact

We will acknowledge your report within **48 hours** and aim to ship a fix within **7 days** for critical issues.

## Scope

The following are considered security issues:

- **XSS vectors** — injection through CSV or JSON import flows, or user-supplied input (file names, account names, category labels) that executes in the DOM
- **Data leakage** — financial data exposed through URLs, clipboard operations, browser history, or screen-sharing-visible UI states
- **File System Access boundary violations** — the app requesting or retaining access outside the user-chosen directory
- **Vulnerable dependencies** — third-party packages with known CVEs that are reachable in the app

## Out of Scope

The following are **not** considered security issues:

- **Physical access to the data folder** — if someone has access to your unlocked device and your data folder, they can read the files directly. This is the user's responsibility. Use full-disk encryption if this is a concern.
- **Plaintext storage** — the app intentionally stores data as plain files. There is no encryption layer in the app. This is a deliberate design choice, not a bug.
- **Social engineering** — tricking a user into sharing their data folder is not a vulnerability in the application.

## Response Expectations

| Severity | Acknowledgement | Target Fix |
| -------- | --------------- | ---------- |
| Critical (XSS, data exposure beyond chosen folder) | 48 hours | 7 days |
| High (File System Access boundary issues) | 48 hours | 14 days |
| Medium (dependency CVEs, minor leakage) | 48 hours | 30 days |
| Low (hardening improvements) | 48 hours | Next release |
