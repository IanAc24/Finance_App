import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { useConsent } from './context/useConsent'
import { useTransactions } from './context/useTransactions'
import ConsentProvider from './context/ConsentProvider'
import DialogProvider from './context/DialogProvider'
import SettingsProvider from './context/SettingsProvider'
import ToastProvider from './context/ToastProvider'
import TransactionsProvider from './context/TransactionsProvider'
import AddFab from './components/AddFab'
import AppBar from './components/AppBar'
import SkipLink from './components/SkipLink'
import DocumentTitle from './components/DocumentTitle'
import ScrollToTop from './components/ScrollToTop'
import HomeScreen from './features/expenses/HomeScreen'
import AddExpenseScreen from './features/expenses/AddExpenseScreen'
import StatisticsScreen from './features/expenses/StatisticsScreen'
import HistoryScreen from './features/expenses/HistoryScreen'
import SettingsScreen from './features/settings/SettingsScreen'
import CategoriesScreen from './features/settings/CategoriesScreen'
import BudgetsScreen from './features/settings/BudgetsScreen'
import RecurringScreen from './features/settings/RecurringScreen'
import SavingsScreen from './features/settings/SavingsScreen'
import OnboardingScreen from './features/onboarding/OnboardingScreen'
import ConsentScreen from './features/legal/ConsentScreen'
import LegalScreen from './features/settings/LegalScreen'
import { hasCurrentConsent } from './lib/legal'

// The consent screen comes first, then the first-use screen; each replaces the
// whole app (no menu, no other route) until it is done. The first-use screen
// can be skipped and is also what "Repeat initial setup" opens
function Shell() {
  const { showOnboarding } = useTransactions()
  const { consent } = useConsent()

  if (!hasCurrentConsent(consent)) {
    return (
      <main id="main" tabIndex={-1}>
        <ConsentScreen />
      </main>
    )
  }

  if (showOnboarding) {
    return (
      <main id="main" tabIndex={-1}>
        <OnboardingScreen />
      </main>
    )
  }

  return (
    <>
      <AppBar />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          {/* different keys so the form starts fresh between add and edit */}
          <Route path="/add" element={<AddExpenseScreen key="add" />} />
          <Route path="/edit/:id" element={<AddExpenseScreen key="edit" />} />
          <Route path="/stats" element={<StatisticsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/categories" element={<CategoriesScreen />} />
          <Route path="/settings/budgets" element={<BudgetsScreen />} />
          <Route path="/settings/recurring" element={<RecurringScreen />} />
          <Route path="/savings" element={<SavingsScreen />} />
          <Route path="/legal/:doc" element={<LegalScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AddFab />
    </>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <DialogProvider>
      <ConsentProvider>
      <TransactionsProvider>
        <BrowserRouter>
          <ToastProvider>
            <SkipLink />
            <ScrollToTop />
            <DocumentTitle />
            <Shell />
          </ToastProvider>
        </BrowserRouter>
      </TransactionsProvider>
      </ConsentProvider>
      </DialogProvider>
    </SettingsProvider>
  )
}
