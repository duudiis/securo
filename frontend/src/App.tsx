import { lazy, Suspense, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { WorkspaceProvider } from '@/contexts/workspace-context'
import { CollectionFilterProvider } from '@/contexts/collection-filter-context'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminRoute } from '@/components/admin-route'
import { AgentsRoute } from '@/components/agents-route'
import { AppLayout } from '@/components/app-layout'

// Import factories kept as named consts so the in-app pages can be preloaded
// (see PAGE_IMPORTS below) — preloading makes navigation instant instead of
// waiting on a chunk fetch mid-transition.
const importDashboard = () => import('@/pages/dashboard')
const importTransactions = () => import('@/pages/transactions')
const importAccounts = () => import('@/pages/accounts')
const importAccountDetail = () => import('@/pages/account-detail')
const importRules = () => import('@/pages/rules')
const importCategories = () => import('@/pages/categories')
const importCollections = () => import('@/pages/collections')
const importBudgets = () => import('@/pages/budgets')
const importRecurring = () => import('@/pages/recurring')
const importGoals = () => import('@/pages/goals')
const importAssets = () => import('@/pages/assets')
const importReports = () => import('@/pages/reports')
const importPayees = () => import('@/pages/payees')
const importGroups = () => import('@/pages/groups')
const importGroupDetail = () => import('@/pages/group-detail')

const SetupPage = lazy(() => import('@/pages/setup'))
const LoginPage = lazy(() => import('@/pages/login'))
const RegisterPage = lazy(() => import('@/pages/register'))
const DashboardPage = lazy(importDashboard)
const TransactionsPage = lazy(importTransactions)
const AccountsPage = lazy(importAccounts)
const AccountDetailPage = lazy(importAccountDetail)
const RulesPage = lazy(importRules)
const CategoriesPage = lazy(importCategories)
const CollectionsPage = lazy(importCollections)
const BudgetsPage = lazy(importBudgets)
const RecurringPage = lazy(importRecurring)
const GoalsPage = lazy(importGoals)
const AssetsPage = lazy(importAssets)
const ReportsPage = lazy(importReports)
const PayeesPage = lazy(importPayees)
const GroupsPage = lazy(importGroups)
const GroupDetailPage = lazy(importGroupDetail)
const AdminSettingsPage = lazy(() => import('@/pages/admin/settings'))
const AgentsListPage = lazy(() => import('@/pages/agents-list'))
const AgentDetailPage = lazy(() => import('@/pages/agent-detail'))
const AgentConnectionsPage = lazy(() => import('@/pages/agent-connections'))
const WorkspaceSettingsPage = lazy(() => import('@/pages/workspace-settings'))
const OAuthCallbackPage = lazy(() => import('@/pages/oauth-callback'))
const OIDCCallbackPage = lazy(() => import('@/pages/oidc-callback'))

// Every in-app page — preloaded on idle so navigation never waits on a chunk.
const PAGE_IMPORTS = [
  importDashboard, importTransactions, importAccounts, importAccountDetail,
  importRules, importCategories, importCollections, importBudgets,
  importRecurring, importGoals, importAssets, importReports, importPayees,
  importGroups, importGroupDetail,
]

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function LoadingFallback() {
  return null
}

/**
 * Renders the routes and preloads every in-app page chunk on idle so
 * navigation never waits on a chunk fetch. The slide-up entrance animation
 * lives in AppLayout (keyed by pathname), animating the live content — no
 * frozen-snapshot crossfade, so async content can't jump mid-transition.
 */
function AppRoutes() {
  useEffect(() => {
    const idle: (cb: () => void) => void =
      typeof window.requestIdleCallback === 'function'
        ? (cb) => window.requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 400)
    idle(() => {
      for (const load of PAGE_IMPORTS) load().catch(() => {})
    })
  }, [])

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/oidc/callback" element={<OIDCCallbackPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <CollectionFilterProvider>
              <AppLayout />
            </CollectionFilterProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/enable-banking" element={<OAuthCallbackPage />} />
        {/* Import merged into the Accounts page */}
        <Route path="/import" element={<Navigate to="/accounts" replace />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/payees" element={<PayeesPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />
        <Route path="/workspace/settings" element={<WorkspaceSettingsPage />} />
        <Route path="/admin" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
        <Route path="/agents" element={<AgentsRoute><AgentsListPage /></AgentsRoute>} />
        <Route path="/agents/connections" element={<AgentsRoute><AgentConnectionsPage /></AgentsRoute>} />
        <Route path="/agents/:id" element={<AgentsRoute><AgentDetailPage /></AgentsRoute>} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Suspense fallback={<LoadingFallback />}>
                <AppRoutes />
              </Suspense>
              <Toaster />
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
