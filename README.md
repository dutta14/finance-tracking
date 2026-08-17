# finance-tracking

**Your money, in your browser, and nowhere else.**

This is a personal finance app for one person, and it lives entirely in your browser. It tracks your net worth, your budget, your transactions, your savings goals, your tax documents, and the little Sunday-morning habits that make all of that sustainable over time; the data can be encrypted on your device with a passphrase you choose, and never touches a server I run. If you want a backup, it can sync to a private GitHub repository of your own. Nothing else leaves your machine, and nothing about you is for sale.

- Browser only.
- Encrypted on your device.
- No lock-in.

![Home dashboard, light and dark](./docs/screenshots/home-light.png)

---

## Why this exists

It is a Sunday morning and I have a spreadsheet open that I have kept, on and off, for the better part of a decade. The date column is wider than it needs to be, in a green I never quite picked on purpose, and the formula in the last row has been broken for two months without me noticing. Before this spreadsheet there were others. There was Mint, while it lasted; there was a subscription app that asked, very politely, for the login to my bank; there was a notebook I kept for one quarter and then misplaced behind a stack of books I was meaning to read. None of them stayed. The spreadsheet stayed, in its half-broken way, because nobody could take it from me.

The pattern repeats. The good apps die or get bought and become something else; the subscriptions keep charging long after I have stopped opening them; the free ones want my bank credentials, and somewhere down in the terms of service is a sentence about how my data may be used to improve the product, which is the polite phrasing for sold. The spreadsheets survive in a quieter way, but they live in browser tabs I forget to close and folders I forget to back up, and the formulas drift, and one day a cell refers to a sheet that no longer exists. None of it ever felt like mine. It always felt borrowed. And there is a small embarrassment, after a while, in handing the keys to your financial life to a company that needs to grow every quarter to keep its lights on, and pretending the arrangement is normal.

So this is small, on purpose. It runs in your browser. If you set a passphrase, the data is encrypted before it touches your disk, and the key stays with you; if you want a backup, you can sync to a private GitHub repository of your own, and that is the only place it ever leaves your machine. There is no account to create. There is no server I run. There is no analytics pixel sitting in the corner of the page, quietly counting how long you spent on the budget screen. It is a small app for one person to keep their own books, on a Sunday morning, in a green they did not quite pick on purpose.

---

## Privacy & data

What follows is the literal version of the promise above. Where your data lives, how it's encrypted, and what this app does not do.

### Where your data lives

Your browser. Not the cloud. Every account, balance, transaction, goal, tax checklist item, uploaded file, and budget record is stored in `localStorage` and `IndexedDB` on the device you're using right now. Close the tab, reopen it, the data is still there. Open it on a different device and you'll start from scratch unless you turn on GitHub Sync or import a backup.

### What "encrypted at rest" means

When you set a passphrase, sensitive data is encrypted with AES-256-GCM before it's written to your browser. That includes account balances, transactions, goals, tax documents, sync credentials, and the rest of the app state that would be awkward to leave lying around in plaintext. If someone opens devtools and inspects your storage, they see ciphertext. The encryption key is derived from your passphrase using PBKDF2 with 600,000 iterations, and the key itself is never stored. It exists in memory only while the app is unlocked.

### What GitHub Sync does

GitHub Sync is opt-in. When you turn it on, the app pushes an encrypted snapshot of your data to a private GitHub repo that you create and own. You provide a personal access token with `repo` scope. The token is stored encrypted in your browser. The repo is yours, the data in it is already encrypted, and you can revoke the token from GitHub settings at any time.

### What this app does not do

No analytics. No third-party scripts. No accounts. No backend. No telemetry, no error reporting, no fingerprinting. No data ever leaves your browser unless you turn on GitHub Sync. You can verify this by opening the Network tab in devtools and watching the app do nothing.

### The trade-off, stated honestly

If you lose your passphrase, your encrypted data is unrecoverable. There is no password reset. There is no support team with a backdoor. There is no recovery email. This is by design.

---

## Quick start (5 minutes)

### 1. Open the app

Go to [anindya.dev/finance-tracking](https://anindya.dev/finance-tracking) in any modern browser. Nothing to install. No signup screen. You land on Home, and from there the rest of the app opens up gradually as you add real data.

![Landing page on first open](./docs/screenshots/quickstart-1.png)

### 2. Set a passphrase

Open Settings from the sidebar and set a passphrase before you get too far. This encrypts your data at rest. Pick something you'll remember, because there is no reset. You can skip it and come back later, but if you plan to use GitHub Sync, do it now.

![Passphrase setup in Settings](./docs/screenshots/quickstart-2.png)

### 3. Add your first account

Go to Net Worth → Accounts and add an account you actually look at every month, a checking account or retirement account works well. Give it a name, pick a type, and save. This is the foundation the dashboard, allocation planner, and goals all build on.

![Add account form](./docs/screenshots/quickstart-3.png)

### 4. Enter a monthly balance

Open that account and add this month's balance. That is enough to make the charts wake up. Come back next month and add another point. You do not need perfect history to get value from it.

![Enter monthly balance](./docs/screenshots/quickstart-4.png)

### 5. Let the rest of the app unfold from there

Go back Home. You'll see the net worth summary, mini charts, goals peek, and allocation bar start to take shape. From there, add a goal, import a budget CSV, or drop your tax documents into Drive. The app is modular. You can grow into it.

![Net worth on the home dashboard](./docs/screenshots/quickstart-5.png)

---

## Features, by page

### Home

![Home dashboard with summary cards](./docs/screenshots/home-light.png)

Your dashboard. A quick read on where things stand right now, without opening six tabs or a spreadsheet you have to mentally parse before coffee.

**How to use it**
- Glance at current net worth and the delta from the previous month
- Flip through the mini charts for Net Worth, FI vs GW, and Assets vs Liabilities
- Use the goals peek to see which targets are on pace and which ones are drifting
- Check the allocation bar to see where your money is actually sitting today
- Drag and reorder the cards until the page matches the way you think

**One tip:** Put the card you check most often in the top-left slot. The dashboard remembers the order, and the right first glance matters more than one more chart.

---

### Goals

![Goals page with FI calculator and sub-goals](./docs/screenshots/goals.png)

Two modes live here: concrete plans and a more abstract FI calculator. One keeps you honest about named goals. The other answers the older, quieter question of when work becomes optional.

**How to use it**
- Use the Plans tab for savings or investment goals with target amounts and dates
- Duplicate a goal when you want to try a more conservative or more aggressive version
- Reorder goals so the ones that matter this year stay near the top
- Mix and match goals to see how they stack together
- Use the Calculator tab to estimate years to financial independence from savings rate and expenses

**One tip:** Create one practical goal and one aspirational one. A near-term emergency fund and a long-term FI target make the page useful in two different time horizons.

---

### Net Worth

![Net Worth page with accounts and growth chart](./docs/screenshots/networth.png)

This is the spine of the app. The Accounts tab gives you the raw history, Allocation turns it into portfolio shape, and Growth lets you connect balances to income, expenses, and savings rate.

**How to use it**
- In Accounts, add accounts and enter monthly balances over time
- Switch between chart view and spreadsheet view depending on whether you want trend or detail
- Hover chart points to see deltas and how a month changed relative to the prior one
- Filter the accounts table when you want to isolate cash, retirement, debt, or other slices
- In Allocation, create custom ratio tabs for your ideal asset mix
- In Growth, log yearly income, expenses, and savings to keep the balance history grounded in behavior

**One tip:** Use Accounts for what happened, Allocation for what you want, and Growth for why the gap exists. The three tabs make more sense when you think of them as history, target, and explanation.

![Allocation tab with ratio targets](./docs/screenshots/allocation.png)

![Growth tab with income, expenses, and savings rate](./docs/screenshots/growth.png)

---

### Budget

![Budget page with categorized transactions](./docs/screenshots/budget.png)

A year-based budgeting workspace that is more interested in patterns than ceremony. Import bank CSVs, clean them up, and look at spending from different distances.

**How to use it**
- Pick a year and import bank or card CSVs, or enter transactions manually
- Use the Detailed view for category-by-category breakdowns inside each group
- Switch to Aggregated when you only want group totals
- Use Cashflow to read income against expenses over time
- Change the period between monthly, quarterly, and half-yearly views
- Use the built-in PDF → CSV converter when the bank only gives you a statement PDF

**One tip:** Start in Aggregated view the first time you import a messy file. It lets you find the categories that matter before you get lost in line items.

---

### Transactions

![Transactions page with filters and categorization](./docs/screenshots/transactions.png)

Transaction management lives on its own page now, separate from Budget. It is for the raw stream of money in and out, with filtering and categorization that helps you clean things up before they become a reporting habit.

**How to use it**
- Review transactions separately from annual budget rollups
- Filter the list when you want to isolate one account, merchant, or category pattern
- Categorize or recategorize items before they pollute your longer-term summaries
- Use it as the place for cleanup work, not just for reading totals

**One tip:** Treat Transactions as the inbox and Budget as the monthly summary. One is where you fix the raw data, the other is where you look for meaning.

---

### Taxes

![Taxes page with checklist and document uploads](./docs/screenshots/taxes.png)

A yearly tax binder without the actual binder. Checklists, uploads, linked accounts, and reusable templates, all organized by year.

**How to use it**
- Move between tax years with the year navigation
- Upload W-2s, 1099s, receipts, and whatever else tends to arrive at inconvenient times
- Work through the checklist and mark items done as they land
- Use linked-account suggestions when you want the app to help connect documents to the right places
- Save or import templates so each year does not start from a blank page

**One tip:** Build next year's template the week you finish this year's return. Your future self will still remember what was annoying.

---

### Drive

![Drive file browser](./docs/screenshots/drive.png)

Drive is the app's file browser for uploaded documents. It gives you one place to browse the practical debris of personal finance, with enough structure to make it useful instead of decorative.

**How to use it**
- Browse uploaded files and folders with breadcrumbs
- Sort and filter when the list gets noisy
- Open CSV previews before you decide what to keep or rename
- Use it as the home for tax files, imported budget data, and other uploads that should stay close to the rest of the app

**One tip:** Rename files while they still mean something to you. "Statement.pdf" is readable today and useless six months from now.

---

### Settings

![Settings page with sync and export options](./docs/screenshots/settings.png)

Profile, sync, appearance, security, backups, and the slightly more dangerous switches all live here.

**How to use it**
- Set or change your passphrase in Security
- Configure GitHub Sync with your repo and token when you want encrypted backups
- Toggle dark mode and accent preferences in Appearance
- Import, export, or reset data from Advanced
- Explore experimental features in Labs and Feature Flags when you are curious

**One tip:** Turn on GitHub Sync only after export works for you locally. A manual backup you understand is a better safety net than an automated one you have not tested.

---

## Common questions

### Is this free?

Yes. Forever. No paid tier, no premium features, no upsell. The app is open source under MIT.

### Where does my data go?

Your browser. It stays in `localStorage` and `IndexedDB` on the device you're using. If you turn on GitHub Sync, an encrypted copy also goes to a private GitHub repo that you own. That's it.

### What if I switch devices?

You have two options. Turn on GitHub Sync to keep devices in sync automatically, or use Export on one device and Import on the other. Without one of those, each device is independent.

### What if I lose my passphrase?

Your encrypted data is unrecoverable. There is no reset, no backdoor. Store your passphrase in a password manager. See "The trade-off, stated honestly" above for the full reasoning.

### Can I export my data?

Yes. Settings has a one-click export as JSON. You can export encrypted or plaintext. Plaintext is portable and human-readable. Encrypted is safer to park in generic cloud storage.

### Is this open source?

Yes. MIT license. Source is at [github.com/dutta14/finance-tracking](https://github.com/dutta14/finance-tracking). Read it, fork it, run it yourself.

### Does it work offline?

Yes, once loaded. The app is a static bundle. After the first visit, your browser caches it and you can use it on a plane, in a tunnel, or with your wifi off. GitHub Sync just waits until you are back online.

### What's the difference between Budget and Transactions?

Transactions is for the raw list: filter, inspect, correct, categorize. Budget is for the roll-up: detailed, aggregated, or cashflow views across a whole year. If you are fixing individual entries, start in Transactions. If you are asking where the money went, start in Budget.

### Do I need to use every page?

No. The app works fine as a net-worth tracker with goals. Or as a budget tool with tax storage. Or as a private archive for documents. Use the parts that solve your actual problem.

### Why no mobile app?

The web app works on mobile browsers, and a native app would require an account system, an app store, and a backend. The whole point of this app is that none of those exist. Add the site to your home screen on iOS or Android and it behaves like an app.

### Is this audited or production-grade?

No formal audit. One person built it. It's used daily by its author. The crypto uses standard Web Crypto primitives (AES-256-GCM, PBKDF2 at 600,000 iterations). Treat it as a personal tool, not a bank.

### Why should I trust this?

You shouldn't blindly trust anything with your financial data. Here's what's true: the source code is public, the app makes no network calls except optional GitHub Sync, which you can verify in devtools, and your data never leaves your browser. Read the code. Or just try it with one account and see for yourself.

---

## More

- **Self-host or contribute:** see [CONTRIBUTING.md](https://github.com/dutta14/finance-tracking/blob/main/CONTRIBUTING.md)
- **Source code:** [github.com/dutta14/finance-tracking](https://github.com/dutta14/finance-tracking)
- **Anindya's blog:** [anindya.dev/blog](https://anindya.dev/blog)
- **License:** MIT

Built in the open, for an audience of one. Useful to anyone who wants the same thing.
