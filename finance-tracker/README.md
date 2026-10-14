# I AM POOR FOR NOW

## What is this app?
A personal finance tracker built with React. I AM POOR FOR NOW (shown as "POBRE, POR AHORA" in the Spanish interface) helps you follow your income and expenses through each quincena (pay period: by default days 1 to 15 and day 16 to the end of the month, or your own one or two pay days), in colones and dollars, in Spanish or English.

> **Status:** in development. All screens work and your data is stored in a SQLite database in the browser (it lives in IndexedDB), so it survives a refresh. For now the app is used in the browser; the Android build has not been started. The app starts empty; sample data is optional.

## Features

**Home**
- The quincena dates with "day X of Y" and a bar of its days
- Per currency, the headline is "You can spend today" (with the days left and what was set aside for recurring bills still due), plus what is left this quincena, income and spent, and the percent of income spent. Spent shows no minus sign when it is zero. With no income yet, it shows what is left instead; messages appear when pending bills exceed the money or the quincena is overspent
- Category bars with budgets (amber from 80%, red when exceeded) and an "Uncategorized" row; on the cards after the first, the list is collapsed to a few rows with "Show all"
- "Due this quincena" list for recurring items: Confirm or Skip; handled items stay listed with a check mark
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

**Recurring, savings and budgets**
- Recurring items (rent, salary, subscriptions): every quincena, monthly in the first quincena (days 1 to 15 by default), or monthly in the second (day 16 to month end by default). Nothing is ever added by itself
- Savings: balance per currency, "Move to savings" and "Take from savings" with a list of movements; money sent to savings is not spending, but it is no longer counted as left
- Budgets: a spending limit per category and currency for each quincena
- Categories: rename, recolor, or delete custom categories and move their transactions

**Statistics and history**
- Statistics: spending bars by week, month or year (last 7 days, 6 months, 3 years), spending by category, past quincenas and recent transactions, per currency
- History: one month at a time with balance, income and spent per currency, transactions grouped by day
- Search by note or category; filters (type, category and payment method) are behind a "Filters" toggle and search every month; the current quincena is totaled per payment method
- CSV export of what History shows (the month, or the search results)

**Settings and safety**
- Quincena schedule: the default is days 1 and 16; you can set your own pay days (one or two a month). A change takes effect after the quincena in progress, so past quincenas keep the way they were cut
- Language (Spanish / English, Spanish (Costa Rica) by default) and theme (dark / light)
- Export everything as CSV, download a backup and restore from one, load sample data and clear all data (which also resets the pay days to 15/30 and forgets skipped leftover offers)
- Only one tab can use the data at a time
- Top bar with the logo and name at the left, the tabs in the middle and Settings at the right; two-column pages on computers, a single column on phones

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

**4. Start the app**

```bash
npm run dev
```

**5. Open it in your browser**

Vite prints a local address in the terminal, usually `http://localhost:5173`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the development server |
| `npm run build` | Creates the production build in `dist/` |
| `npm run preview` | Previews the production build locally (run `build` first) |
| `npm run lint` | Checks the code with ESLint |
| `npm test` | Runs the automated tests once |

## Tech stack

| Layer | Technology | Status |
| --- | --- | --- |
| UI | React | In use |
| Build tool | Vite | In use |
| Routing | React Router | In use |
| App state | React Context | In use |
| Styling | Plain CSS in `src/index.css` | In use |
| Font | Poppins, self-hosted with `@fontsource/poppins` | In use |
| Storage | SQLite via `@capacitor-community/sqlite` (`jeep-sqlite` with WebAssembly + IndexedDB in the browser) | In use |
| Tests | Vitest, plus sql.js to run the real SQL of the database layer against an in-memory SQLite | In use |
| Linting | ESLint | In use |
| Android app | Capacitor | Installed, not built yet |
| Cloud backups | To be decided | Later |

### Why these choices

- **React** builds the interface from small, reusable components.
- **Vite** gives a fast dev server with hot reload and creates the production build.
- **React Router** handles navigation between screens without reloading the page.
- **React Context** holds app-wide settings such as language and theme, plus the transactions and categories.
- **Plain CSS** keeps styling simple, with no styling library. All styles live in one file, `src/index.css`, with comments in Spanish.
- **SQLite** (in use) is a single local database file with no server to run, which suits a personal app.
- **Capacitor** (installed) will let the same React app be packaged as an Android app.
- **Poppins**, the title font, is bundled with the app through `@fontsource/poppins`, so it works offline.
- **ESLint** uses the Vite template defaults. There is no Prettier or custom formatting.

### Data and storage

- **Where it lives:** a SQLite database. In the browser it is kept in memory and saved to IndexedDB. A fresh install starts with no transactions and the four built-in categories (Food, Transport, Bills, Fun).
- **Schema (version 6):** `categories` (built-in and custom), `transactions`, `budgets` (a limit per category and currency), `recurring` (repeating items and the last quincena handled) and `savings` (money moved in or out of savings). Transactions also keep the payment method (version 5), and the quincena schedule is saved with the settings (version 6).
- **Internal names kept for compatibility:** the database is named `quincena`, the tab lock is `quincena-db` and backup files carry the marker `app: 'quincena'`; these are internal names the user never sees, and they stay unchanged so existing data and old backups keep working.
- **Amounts** are stored as whole cents to avoid rounding errors.
- **Migrations** in `src/db/migrations.js` are versioned, one per schema version, and are never edited once shipped: a change is a new migration.
- **Access:** screens never touch storage directly. They read and write through `TransactionsProvider`, and `src/db/storage.js` is the only file with SQL. Writes are queued and run one at a time.
- **Old data:** on the first launch after upgrading, data saved by the older `localStorage` version is imported once. The old copy is left untouched.
- **WebAssembly file:** `public/assets/sql-wasm.wasm` must be the one from sql.js 1.11.0, the version `jeep-sqlite` 2.8.0 is built with. It is not the same as the sql.js installed for the tests (1.14.x), so do not copy that one over it.
- **One tab at a time:** each tab keeps its own copy of the database in memory and saves all of it, so a second tab would overwrite the first. A second tab is blocked with a message instead.
- **Persistent storage:** the app asks the browser to keep the data safe from clean-up, which the browser may or may not grant.
- **Backups:** the JSON backup holds your custom categories, transactions, budgets, recurring items and savings (the built-in categories are in every install). Restoring one replaces all current data. It is the way to move your data between browsers or to protect it if the browser's storage is cleared. Cloud backups come later.
- **Preferences** are not in the backup. They stay in the browser's `localStorage`: language, theme, the last currency and category used, the date of the last backup, and which leftover offers were skipped.
- **Sample data:** `src/db/mockData.js` holds the built-in categories and the optional sample transactions.

## Project structure

```text
public/
  assets/sql-wasm.wasm  SQLite WebAssembly file (see Data and storage)
  favicon.svg           Browser tab icon
  logo.svg              Standalone logo artwork
src/
  components/           Shared interface components (app bar and tabs, bar charts, keypad, rows and pills)
  context/              Settings (language, theme) and transactions: contexts, providers and hooks
  db/
    database.js         Opens SQLite and runs the migrations
    migrations.js       Schema migrations
    migrations.test.js  Tests for the migrations
    mockData.js         Built-in categories and optional sample transactions
    storage.js          Reads and writes data (the only file with SQL)
    storage.test.js     Tests for the storage layer
    tabLock.js          Allows only one open tab at a time
    testDb.js           In-memory SQLite (sql.js) used by the tests
  features/
    expenses/           Home, add and edit, statistics and history screens
    settings/           Settings, categories, budgets, recurring and savings screens
  lib/                  Helpers: backup, categories, csv, dates, money, prefs,
                        recurring, savings, search, stats, suggest, translations
                        and useToday. Tests sit next to the code as *.test.js
  App.jsx               Routes and page layout
  Header.jsx            App title
  index.css             All styles
  main.jsx              App entry point
```

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
- [x] "Safe to spend per day" on the dashboard
- [x] Settings screen
- [x] SQLite storage
- [x] Backup file and restore
- [x] Budgets
- [x] Recurring transactions
- [x] Savings
- [x] Automated tests
- [ ] Android app with Capacitor
- [ ] Cloud backups

## Progress log

Newest first.

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
