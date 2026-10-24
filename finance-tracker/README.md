# I AM POOR FOR NOW

## What is this app?
A personal finance tracker built with React. I AM POOR FOR NOW (shown as "POBRE, POR AHORA" in the Spanish interface) helps you follow your income and expenses through each quincena (pay period: by default days 1 to 15 and day 16 to the end of the month, or your own one or two pay days), in colones and dollars, in Spanish or English.

> **Status:** in development. All screens work. You sign in with email and password, and each account's data is kept in Firebase Firestore, so only that account sees it and it is the same in any browser. For now the app is used in the browser; the Android build has not been started. The app starts empty; sample data is optional.

## Features

**Account and consent**
- Sign in with email and password, create an account (`/registro`, open to anyone unless `VITE_ALLOW_SIGNUP=0`) and recover a password by email, in the app language
- Before the welcome, the app asks for consent to the current legal texts (privacy policy, terms), which can also be read inside the app; the language can be chosen first
- On the first sign-in, data left on this device by the older local version is offered once to the account

**Welcome and profile**
- On first use a welcome screen asks for a few things in five steps: your name and main currency, when you get paid, how much you earn per pay, your fixed expenses and a savings goal. Every step can be skipped, or the whole setup
- Your name is shown as a greeting on Home
- Settings > "Repeat initial setup" opens the welcome again, over the data already there

**Home**
- The quincena dates with "day X of Y" and a bar of its days
- Per currency, the headline is "You can spend today" (with the days left and what was set aside for recurring bills still due; the savings goal is set aside first), plus what is left this quincena, income and spent, and the percent of income spent. Spent shows no minus sign when it is zero. With no income yet, it shows what is left instead; messages appear when pending bills exceed the money or the quincena is overspent
- Category bars with budgets (amber from 80%, red when exceeded) and an "Uncategorized" row; on the cards after the first, the list is collapsed to a few rows with "Show all"
- "Due this quincena" list for recurring items: Confirm or Skip; handled items stay listed with a check mark
- With the "I was paid" pay-day mode, a card on Home lets you register the day you were paid (today or another date), which starts a new quincena
- Last quincena's leftover can be moved to savings with one tap ("Move to savings") or skipped
- Later-dated transactions are flagged, and the five most recent ones are listed
- A backup reminder when the last backup is more than 14 days old; with no backup yet, the 14 days count from the oldest transaction

**Adding and editing**
- Add expenses and income with a numeric keypad, in colones or dollars, and choose how it was paid (Cash, Card or SINPE; the last one used is remembered). In colones the keypad has a "000" key, and on a computer you can type the amount with the keyboard. Save stays visible at the bottom of the screen
- Remembers the last currency and category used, and suggests notes from past entries
- Custom expense categories: type a new name while adding
- Tap any transaction to edit or delete it, or use "Repeat today" to copy it as a new entry
- Date guard: an invalid date cannot be saved, and a warning shows for dates more than 3 days ahead
- A hand-typed bill that matches a due recurring item offers to mark it as paid, so it is not counted twice
- When adding income, part of it can be sent straight to savings

**Income**
- Income screen (`/income`): totals per currency for the month, the year or a custom period, split by source (salary, freelance, gift, other), with the list of income entries
- Each income entry can carry a source; filters are remembered per account

**Savings and the piggy bank**
- Savings screen (`/savings`): balance per currency with an animated piggy bank that fills toward your goals. A coin drops in only after a deposit is confirmed as saved; a withdrawal shakes a coin out
- "Move to savings" and "Take from savings" with a list of movements; money sent to savings is not spending, but it is no longer counted as left. A withdrawal can never take more than the balance, and colones are whole amounts
- Savings goals with a name and an amount per currency; reaching one is celebrated once
- Yearly report per currency (opening balance, saved, taken out, closing balance) and an annual recap page (`/savings/recap/:year`)
- Animations follow the system "reduce motion" setting

**Recurring and budgets**
- Recurring items (rent, salary, subscriptions): every quincena, monthly in the first quincena (days 1 to 15 by default), or monthly in the second (day 16 to month end by default). Nothing is ever added by itself
- Budgets: a spending limit per category and currency for each quincena
- Categories: rename, recolor, or delete custom categories and move their transactions

**Statistics and history**
- Statistics: spending bars by week, month or year (last 7 days, 6 months, 3 years), spending by category, past quincenas and recent transactions, per currency
- History: one month at a time with balance, income and spent per currency, transactions grouped by day
- Search by note or category; filters (type, category and payment method) are behind a "Filters" toggle and search every month; the current quincena is totaled per payment method
- CSV export of what History shows (the month, or the search results)
- PDF export of everything or one month: a printable report that opens the browser's print dialog ("Save as PDF")
- An "Income" chip in History opens the Income screen

**Settings and safety**
- Quincena schedule: the default is days 1 and 16; you can set your own pay days (one or two a month), or choose "I was paid" when your pay lands on different days each month: a quincena then starts on the day you register a payment. A change takes effect after the quincena in progress, so past quincenas keep the way they were cut
- Language (Spanish / English, Spanish (Costa Rica) by default; also switchable from the top bar) and theme (dark / light)
- Export everything as CSV, download a backup and restore from one, load sample data and clear all data (which also resets the pay days to 15/30 and forgets skipped leftover offers)
- Only one tab can use the data at a time
- On computers: a top bar with the logo and name, the tabs (Home, Add, History, Income, Savings, Statistics) and Settings, with two-column pages. On phones: a single column, Settings in the top bar and a bottom tab bar (Home, History, +, Savings, Statistics)
- Original illustrations on empty screens, the welcome and success messages

## Getting started

### Before you begin

You need **Node.js 22.13.0 or newer**. Odd-numbered versions such as 23 are not supported (use 22.13+, 24 or 26+). Check with:

```bash
node --version
```

If it is older, install the latest LTS from [nodejs.org](https://nodejs.org).

### Steps

**1. Clone the repository**

```bash
git clone https://github.com/<your-username>/<repo-name>.git
```

**2. Go into the project folder**

```bash
cd finance-tracker
```

**3. Install dependencies**

```bash
npm install
```

This is the only install command you need. Do not install packages one by one.

**4. Add the Firebase settings**

Copy `.env.example` to `.env.local` and fill it in with the web app settings from the Firebase console (Project settings > Your apps). `.env.local` is ignored by git: never commit it or paste it anywhere.

**5. Start the app**

```bash
npm run dev
```

**6. Open it in your browser**

Vite prints a local address in the terminal, usually `http://localhost:5173`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the development server |
| `npm run build` | Creates the production build in `dist/` |
| `npm run preview` | Previews the production build locally (run `build` first) |
| `npm run lint` | Checks the code with ESLint |
| `npm test` | Runs the automated tests once |
| `npm run e2e` | Runs the browser tests with Playwright (Microsoft Edge, fake sign-in, local data) |
| `npm run e2e:headed` | The same, with the browser window visible |
| `npm run qa:firebase` | Runs the rules and browser tests against the **real** Firebase project (needs `.env.qa.local`; see [the QA guide](../docs/qa/guia-qa.md)) |
| `npm run qa:firebase:rules` / `qa:firebase:e2e` | Only the rules part, or only the browser part, of the real-Firebase suite |
| `npm run qa:firebase:cleanup` | Deletes what a QA run left in the real project |
| `npm run qa:firebase:accounts` | Creates the QA test accounts (a person runs it, never Claude Code) |

## Tech stack

| Layer | Technology | Status |
| --- | --- | --- |
| UI | React | In use |
| Build tool | Vite | In use |
| Routing | React Router | In use |
| App state | React Context | In use |
| Styling | Plain CSS in `src/index.css` | In use |
| Font | Poppins, self-hosted with `@fontsource/poppins` | In use |
| Icons | [Lucide](https://lucide.dev), ISC licence (some icons MIT, from Feather); only the SVG path data of the icons used is copied into `src/components/CategoryIcon.jsx` | In use |
| Illustrations | Original, drawn for this project in the style of the logo (`src/components/Illustration.jsx`); no licence needed | In use |
| Sign-in | Firebase Authentication (email and password) | In use |
| Cloud data | Firebase Firestore, one space per account (`users/{uid}/…`), with rules in `firestore.rules` | In use |
| Local storage | SQLite via `@capacitor-community/sqlite` (`jeep-sqlite` with WebAssembly + IndexedDB in the browser) | Kept as a fallback (`VITE_DATA_BACKEND=local`) and for the tests |
| Animation | Plain CSS and the browser's Web Animations API, no library | In use |
| Tests | Vitest, plus sql.js to run the real SQL of the database layer against an in-memory SQLite | In use |
| Browser tests | Playwright, with the installed Microsoft Edge | In use |
| Hosting | Netlify (`public/_redirects`, guide in `docs/despliegue-netlify.md`) | Ready |
| Linting | ESLint | In use |
| Android app | Capacitor | Installed, not built yet |

### Why these choices

- **React** builds the interface from small, reusable components.
- **Vite** gives a fast dev server with hot reload and creates the production build.
- **React Router** handles navigation between screens without reloading the page.
- **React Context** holds app-wide settings such as language and theme, plus the transactions and categories.
- **Plain CSS** keeps styling simple, with no styling library. All styles live in one file, `src/index.css`, with comments in Spanish.
- **Firebase** gives sign-in and a per-account cloud database without running a server; the security rules keep each account to its own data.
- **SQLite** is a single local database file with no server to run. It was the first storage and stays as a fallback.
- **Capacitor** (installed) will let the same React app be packaged as an Android app.
- **Poppins**, the title font, is bundled with the app through `@fontsource/poppins`, so it works offline.
- **ESLint** uses the Vite template defaults. There is no Prettier or custom formatting.

### Data and storage

- **Where it lives:** by default in Firestore, under `users/{uid}/` with the collections `transactions`, `categories`, `budgets`, `recurring`, `savings`, `goals` and `meta` (profile and pay-day schedule). Only that account can read or write it (`firestore.rules`; see `docs/datos-por-cuenta.md`). With `VITE_DATA_BACKEND=local` it goes back to one SQLite database on the device, kept in memory and saved to IndexedDB. `src/db/dataStore.js` picks one. A new account starts with no transactions and the four built-in categories (Food, Transport, Bills, Fun).
- **Saving a savings move:** the app waits for the server to confirm it before the piggy bank animates; ids are made once per action so a retry never saves it twice.
- **Schema (version 9):** `categories` (built-in and custom), `transactions`, `budgets` (a limit per category and currency), `recurring` (repeating items and the last quincena handled) and `savings` (money moved in or out of savings). Transactions also keep the payment method (version 5). Added since: `quincena_config` (when the quincena starts, version 6), `profile` (name, currency, income, savings goal and whether the welcome was done, version 7), `quincena_manual` (the days marked with "I was paid", version 8), and the income `source` on transactions plus the `goals` table (savings goals, version 9).
- **Internal names kept for compatibility:** the database is named `quincena`, the tab lock is `quincena-db` and backup files carry the marker `app: 'quincena'`; these are internal names the user never sees, and they stay unchanged so existing data and old backups keep working.
- **Amounts** are stored as whole cents to avoid rounding errors.
- **Migrations** in `src/db/migrations.js` are versioned, one per schema version, and are never edited once shipped: a change is a new migration.
- **Access:** screens never touch storage directly. They read and write through `TransactionsProvider`; `src/db/storage.js` is the only file with SQL and `src/db/cloudStorage.js` the only one that talks to Firestore. Writes are queued and run one at a time.
- **Old data:** on the first launch after upgrading, data saved by the older `localStorage` version is imported once. The old copy is left untouched.
- **WebAssembly file:** `public/assets/sql-wasm.wasm` must be the one from sql.js 1.11.0, the version `jeep-sqlite` 2.8.0 is built with. It is not the same as the sql.js installed for the tests (1.14.x), so do not copy that one over it.
- **One tab at a time:** each tab keeps its own copy of the database in memory and saves all of it, so a second tab would overwrite the first. A second tab is blocked with a message instead.
- **Persistent storage:** the app asks the browser to keep the data safe from clean-up, which the browser may or may not grant.
- **Backups:** the JSON backup holds your custom categories, transactions (with their income source), budgets, recurring items, savings, savings goals, the pay-day schedule and the profile (the built-in categories are in every install). Restoring one replaces all current data. Older backups still restore.
- **Preferences** are not in the backup. They stay in the browser's `localStorage`: language, theme, the last currency, category and payment method used, the date of the last backup, and which leftover offers were skipped.
- **Sample data:** `src/db/mockData.js` holds the built-in categories and the optional sample transactions.

## Project structure

- `public/`: static files. `assets/sql-wasm.wasm` is the SQLite WebAssembly file (see Data and storage); `favicon.svg` is the browser tab icon.
- `src/components/`: shared interface pieces (app bar and tabs, bar charts, keypad, pills, rows).
- `src/context/`: settings (language, theme) and transactions: contexts, providers and hooks.
- `src/db/`: the Firestore layer (`cloudStorage.js`), SQLite (`storage.js`, the only file with SQL), `dataStore.js` that picks one, the migrations, the built-in categories and sample data, the tab lock and the test database.
- `src/features/auth/`: sign-in, sign-up and password recovery.
- `src/features/legal/`: the consent screen.
- `src/features/expenses/`: Home, add and edit, statistics and history screens.
- `src/features/income/`: the Income screen.
- `src/features/savings/`: the Savings screen, piggy bank forms, goals, yearly report and annual recap.
- `src/features/report/`: the printable PDF report.
- `src/features/settings/`: Settings, categories, budgets, recurring and legal pages.
- `src/features/onboarding/`: the first-use welcome screen.
- `src/qa/`: QA unit tests with seeded data.
- `e2e/`: Playwright browser tests (`e2e/firebase/` runs against the real project).
- `qa-firebase/`: the runner, rules tests and account script for the real-Firebase suite.
- `firestore.rules`: the Firestore security rules (published by a person in the Firebase console).
- `src/lib/`: pure helpers (backup, dates, money, quincena rules, translations and more). Tests sit next to the code as `*.test.js`.
- `src/App.jsx`: routes and page layout. `src/main.jsx`: app entry point. `src/index.css`: all styles.

## Troubleshooting

- **`npm install` fails or shows engine warnings:** update Node.js to 22.13.0 or newer (see Getting started).
- **Port 5173 is already in use:** Vite will pick the next free port and print it in the terminal.
- **Stale content after many quick edits:** stop the server (`Ctrl + C`), run `npm run dev` again and refresh the browser.
- **"I AM POOR FOR NOW is already open in another tab":** close the other tab and press Try again.
- **Stuck on "Opening your data…":** a tab opened in the background may not start the database; bring it to the front.
- **A WebAssembly link error when the app starts:** `public/assets/sql-wasm.wasm` does not match `jeep-sqlite`. Use the file from sql.js 1.11.0 (see Data and storage).

## Roadmap

- [x] React project created and pushed to GitHub
- [x] Dashboard and statistics screens
- [x] Spanish / English and dark / light mode
- [x] Colones and dollars
- [x] Add, edit and delete transactions
- [x] Custom categories and category management
- [x] History screen, with search and filters
- [x] CSV export
- [x] Start empty, with optional sample data
- [x] "You can spend today" on the dashboard
- [x] Settings screen
- [x] SQLite storage
- [x] Backup file and restore
- [x] Budgets
- [x] Recurring transactions
- [x] Savings
- [x] Automated tests
- [x] Email and password sign-in, data per account in the cloud (Firebase)
- [x] PDF export
- [x] Income screen with sources
- [x] Savings screen with goals, a yearly report and an animated piggy bank
- [x] Browser tests and QA against the real Firebase
- [ ] Publish the repo's Firestore rules (ficha 006)
- [ ] Android app with Capacitor

## Progress log

Newest first.

### 2026-10-24
- Income screen with sources (salary, freelance, gift, other)
- Savings screen: animated piggy bank, goals with a one-time celebration, yearly report and annual recap (migration v9, Firestore `goals`)
- QA: browser tests with Playwright, a suite against the real Firebase, a QA guide, and fixes for half-percent shares and the top-budget percent
- Ficha 006 to publish the repo's Firestore rules

### 2026-10-23
- Email and password sign-in, sign-up and password recovery; each account's data in Firestore, with this device's old data offered once
- Consent screen before the welcome, legal pages in the app
- Redesign: design system, Home, Add, History, phone tab bar, bigger top bar with a language switch, original illustrations
- PDF export of everything or one month; "pay period" in English
- Netlify redirects and deploy guide
- Merge PAT into ZOH: the savings goal is set aside before the daily amount; working notes and docs for Claude and Claude Code

### 2026-10-19
- Set the savings goal aside before the "You can spend today" amount

### 2026-10-14
- Merge main into ZOH: welcome screen, "I was paid" pay days and the profile
- 0.23: Welcome screen on first use, profile with name and savings goal in backups, "I was paid" pay days (migrations v7 and v8)

### 2026-10-13
- 0.22: Merge PAT into main: payment method with a History filter, configurable quincena, closing rules
- 0.21: Handled recurring items stay listed, Spanish leftover note, calmer backup reminder
- 0.20: App name, logo and website layout

### 2026-10-12
- Website layout: full-width top bar, centered headings, two-column pages on wide screens
- Logo: rising bars with a coin, shown at the top left and as the tab icon
- 0.19: Dashboard shows savings in the numbers, offers to move last quincena's leftover to savings, shorter layout
- 0.18: Savings: balance per currency, moves in and out, a share of an income sent to savings
- 0.17: Visual refinements; History filters behind a toggle; past quincenas trimmed
- 0.16: A hand-typed bill that matches a due recurring item can be marked as paid
- 0.15: Note suggestions and "Repeat today"; amounts never wrap and the editor spacing is tidier
- 0.14: Dashboard numbers: current day count overnight, a currency with only pending bills is shown, later-dated expenses are flagged
- 0.13: Tests for migrations and the storage layer
- 0.12: One tab at a time, persistent storage request, backup reminder and a loading message
- 0.11: Review tidy-ups and visual polish
- 0.10: Last currency and category remembered; pending bills counted in safe-to-spend; backup file and restore
- 0.9: Recurring transactions, past quincenas on Statistics, search and filters in History, automated tests, self-hosted font and review fixes
- 0.8: SQLite storage with a one-time import of existing data; Settings, Categories and Budgets screens; edit and delete transactions; CSV export; "Safe to spend per day"; sample data and clear all data
- 0.7: Navigation moved to the top
- 0.6: Custom categories on the Add screen; cleanup of unused starter files; styles commented in Spanish
- 0.5: Add-expense screen with a numeric keypad; app title
- 0.4: Visual update; Statistics screen
- 0.3: Language and theme switching; Home, Add and History screens with sample data
- 0.1 to 0.2: Project created and pushed to GitHub; React, Vite and ESLint set up
