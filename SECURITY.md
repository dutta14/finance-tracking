# Security Policy

## Security Model

Finance Tracking is a fully client-side React application hosted on GitHub Pages. There is no backend server, no database, and no server-side data collection.

- All financial data is stored in the browser's `localStorage`, encrypted at rest with AES-256-GCM using PBKDF2 key derivation.
- Optional GitHub sync uses a Personal Access Token (PAT) stored encrypted in `localStorage`.
- No cookies, analytics, or PII leave the browser.

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

- **Encryption bypass or weakness** — flaws in the AES-256-GCM implementation, weak key derivation, or plaintext data exposure in `localStorage`
- **XSS vectors** — injection through import/export flows (CSV, JSON) or user-supplied input that executes in the DOM
- **Token exposure** — PATs or sensitive data leaked in network requests, console logs, or error messages
- **Data leakage** — financial data exposed through URLs, clipboard operations, browser history, or screen-sharing-visible UI states
- **Vulnerable dependencies** — third-party packages with known CVEs that are reachable in the app

## Out of Scope

The following are **not** considered security issues:

- **Physical access to the browser** — if someone has access to your unlocked device, they can read `localStorage` directly. This is the user's responsibility.
- **Browser extensions reading `localStorage`** — extensions with storage permissions operate outside our security boundary. This is part of the browser security model.
- **Social engineering** — tricking a user into exporting and sharing their data is not a vulnerability in the application.

## Response Expectations

| Severity | Acknowledgement | Target Fix |
| -------- | --------------- | ---------- |
| Critical (data exposure, encryption bypass) | 48 hours | 7 days |
| High (XSS, token leakage) | 48 hours | 14 days |
| Medium (dependency CVEs, minor leakage) | 48 hours | 30 days |
| Low (hardening improvements) | 48 hours | Next release |
