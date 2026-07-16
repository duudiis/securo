import { useState, useCallback, useEffect, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/auth-context'
import { CollectionSelector } from '@/components/collection-selector'
import { auth as authApi, backup as backupApi, admin as adminApi } from '@/lib/api'
import { resolveSupportedLang } from '@/lib/i18n'
import { toast } from 'sonner'
import { OnboardingTour } from '@/components/onboarding-tour'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/build-info'
import { ShellLogo } from '@/components/shell-logo'
import { UpdateAvailableBanner } from '@/components/update-available-banner'
import { UpdateAvailableDialog } from '@/components/update-available-dialog'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'
import {
  ArrowLeftRight,
  Building2,
  SlidersHorizontal,
  Menu,
  Tag,
  PiggyBank,
  Target,
  Eye,
  EyeOff,
  Repeat,
  Landmark,
  Users,
  Split,
  BarChart3,
  Sun,
  Moon,
  Languages,
  KeyRound,
  Check,
  HardDriveDownload,
  Shield,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react'
import { usePrivacyMode } from '@/hooks/use-privacy-mode'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { TwoFactorSetup } from '@/components/two-factor-setup'
import { PasskeyManagementDialog } from '@/components/passkey-management-dialog'
import { CommandPalette } from '@/components/command-palette'
import { PageTransition } from '@/components/page-transition'
import { useCommandPaletteHotkey } from '@/hooks/use-command-palette-hotkey'
import { GlobalChatPanel } from '@/components/global-chat-panel'
import { useFeatureFlags } from '@/hooks/use-feature-flags'
import { Bot, Search, Sparkles } from 'lucide-react'
import { setThemeBasedOnSystem } from '@/lib/theme-utils'

type NavItem =
  | { type: 'link'; key: string; path: string; icon: React.ElementType }
  | { type: 'separator'; labelKey: string }

const navItems: NavItem[] = [
  // The dashboard ("Painel") is now reachable by clicking the Securo
  // logo + name in the sidebar header — no dedicated menu item to keep
  // the sidebar focused on the main destinations. Transactions sits
  // inside the ACCOUNTS section since it's account-scoped data.
  { type: 'separator', labelKey: 'nav.groupAccounts' },
  { type: 'link', key: 'transactions', path: '/transactions', icon: ArrowLeftRight },
  { type: 'link', key: 'accounts', path: '/accounts', icon: Building2 },
  { type: 'separator', labelKey: 'nav.groupAnalysis' },
  { type: 'link', key: 'reports', path: '/reports', icon: BarChart3 },
  { type: 'link', key: 'assets', path: '/assets', icon: Landmark },
  { type: 'separator', labelKey: 'nav.groupSetup' },
  { type: 'link', key: 'budgets', path: '/budgets', icon: PiggyBank },
  { type: 'link', key: 'goals', path: '/goals', icon: Target },
  { type: 'link', key: 'recurring', path: '/recurring', icon: Repeat },
  { type: 'link', key: 'categories', path: '/categories', icon: Tag },
  { type: 'link', key: 'payees', path: '/payees', icon: Users },
  { type: 'link', key: 'splitGroups', path: '/groups', icon: Split },
  { type: 'link', key: 'rules', path: '/rules', icon: SlidersHorizontal },
]

export function AppLayout() {
  const { t } = useTranslation()
  const { user, logout, updateUser } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { privacyMode, togglePrivacyMode } = usePrivacyMode()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [passkeysOpen, setPasskeysOpen] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  useCommandPaletteHotkey(setPaletteOpen)
  const { agentsEnabled } = useFeatureFlags()

  // ⌘J / Ctrl+J toggles the global slide-over chat from anywhere.
  // Distinct from ⌘K (command palette) so users can have both open.
  // Gated on agentsEnabled so the hotkey is a no-op when the feature is
  // off — keeps ⌘J free for browsers/other tools.
  useEffect(() => {
    adminApi.defaultColors().then(({ light, dark }) => {
      setThemeBasedOnSystem(light, dark, resolvedTheme)
    }).catch(() => {})
    
    if (!agentsEnabled) return
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        setChatOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [agentsEnabled, resolvedTheme])
  // The "Agents" management page used to live in the sidebar, but it's
  // a configuration surface (KB upload, providers, default selection),
  // not a daily destination. Moved to the user menu (Change password,
  // 2FA, Backups, AI agents).
  const finalNavItems: NavItem[] = navItems
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  const showTour =
    user &&
    !user.preferences?.onboarding_completed &&
    !localStorage.getItem('onboarding_completed')

  const handleTourComplete = useCallback(async () => {
    localStorage.setItem('onboarding_completed', 'true')
    try {
      const prefs = {
        ...(user?.preferences || {}),
        onboarding_completed: true,
      }
      const updated = await authApi.updateMe({ preferences: prefs })
      updateUser(updated)
    } catch {
      // localStorage fallback is already set
    }
  }, [user, updateUser])

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? '?'
  const resolvedThemeLocal = theme === 'system' ? undefined : theme
  const isDark = resolvedThemeLocal
    ? resolvedThemeLocal === 'dark'
    : typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    if (doc.startViewTransition) {
      // One compositor-level crossfade of the whole screen — every element
      // (sidebar, tables, inputs) switches in perfect sync. flushSync makes
      // the theme class land inside the transition's snapshot callback.
      doc.startViewTransition(() => {
        flushSync(() => setTheme(next))
      })
    } else {
      // Fallback (see .theme-transition in index.css): force one shared
      // transition timing on every element for the toggle duration.
      const root = document.documentElement
      root.classList.add('theme-transition')
      setTheme(next)
      window.setTimeout(() => root.classList.remove('theme-transition'), 350)
    }
  }

  const versionA11yLabel = t('app.versionAriaLabel', { version: APP_VERSION })

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-sidebar border-b border-sidebar-border px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-sidebar-muted hover:text-sidebar-foreground transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <Link
          to="/"
          className="flex items-center gap-2 -mx-1 px-1 py-1 rounded-md hover:bg-hover transition-colors"
          aria-label={t('app.name')}
          title={t('nav.dashboard')}
        >
          <ShellLogo size={22} className="text-primary shrink-0" />
          <span className="font-bold text-sidebar-foreground">
            {t('app.name')}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1"
            title={t('cmdk.triggerAria')}
            aria-label={t('cmdk.triggerAria')}
          >
            <Search size={18} />
          </button>
          <button
            onClick={togglePrivacyMode}
            className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1"
            title={privacyMode ? t('privacy.show') : t('privacy.hide')}
          >
            {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button
            onClick={toggleTheme}
            className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1"
            title={isDark ? t('settings.themeLight') : t('settings.themeDark')}
            aria-label={
              isDark ? t('settings.themeLight') : t('settings.themeDark')
            }
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {/* AI chat — opens the global slide-over (also reachable via
              ⌘J). Sits next to the theme toggle so the icon is always
              within thumb reach on mobile too. */}
          {agentsEnabled && (
            <button
              onClick={() => setChatOpen(true)}
              className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1"
              title={`${t('agents.globalChat.title', 'Chat')} (${isMac ? '⌘J' : 'Ctrl+J'})`}
              aria-label={t('agents.globalChat.openHint', 'Open chat (⌘J)')}
            >
              <Bot size={18} />
            </button>
          )}
          <UserMenu
            userInitial={userInitial}
            logout={logout}
            onChangePassword={() => setChangePasswordOpen(true)}
            onTwoFactor={() => setTwoFactorOpen(true)}
            onPasskeys={() => setPasskeysOpen(true)}
            agentsEnabled={agentsEnabled}
            backingUp={backingUp}
            onBackup={async () => {
              setBackingUp(true)
              try {
                await backupApi.download()
                toast.success(t('backup.success'))
              } catch {
                toast.error(t('backup.error'))
              } finally {
                setBackingUp(false)
              }
            }}
            dark
            isAdmin={user?.is_superuser}
          />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transform transition-transform lg:translate-x-0 shrink-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {/* Logo — clickable link to the dashboard. Replaces the
              dedicated 'Painel' nav item so the sidebar stays focused
              on the main destinations. */}
          <div className="flex h-16 min-h-16 items-center justify-between px-5 border-b border-sidebar-border shrink-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-md hover:bg-hover transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label={t('app.name')}
              title={t('nav.dashboard')}
            >
              <ShellLogo size={24} className="text-primary shrink-0" />
              <span className="font-bold text-lg text-sidebar-foreground tracking-tight">
                {t('app.name')}
              </span>
            </Link>
            <div className="flex items-center gap-0.5">
              <button
                onClick={togglePrivacyMode}
                className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-hover"
                title={privacyMode ? t('privacy.show') : t('privacy.hide')}
                aria-label={privacyMode ? t('privacy.show') : t('privacy.hide')}
              >
                {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {/* AI chat — same trigger as the mobile bar, ⌘J also
                  works. Lives in the sidebar header so the entry point
                  is visible even on first load (no floating button). */}
              {agentsEnabled && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-hover"
                  title={`${t('agents.globalChat.title', 'Chat')} (${isMac ? '⌘J' : 'Ctrl+J'})`}
                  aria-label={t('agents.globalChat.openHint', 'Open chat (⌘J)')}
                >
                  <Bot size={16} />
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-hover"
                title={
                  isDark ? t('settings.themeLight') : t('settings.themeDark')
                }
                aria-label={
                  isDark ? t('settings.themeLight') : t('settings.themeDark')
                }
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>

          {/* Command palette trigger */}
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={cn(
                'group flex w-full items-center gap-2 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-2',
                'text-[12.5px] text-sidebar-muted transition-all',
                'hover:bg-hover hover:text-sidebar-foreground hover:border-sidebar-border',
              )}
              aria-label={t('cmdk.triggerAria')}
            >
              <Search size={13} className="shrink-0" />
              <span className="flex-1 text-left">{t('cmdk.triggerLabel')}</span>
              <kbd className="hidden lg:inline-flex h-[17px] items-center rounded border border-sidebar-border bg-sidebar px-1 font-mono text-[9.5px] font-semibold text-sidebar-muted/80">
                {isMac ? '⌘' : 'Ctrl'}&nbsp;K
              </kbd>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Nav */}
          <nav className="flex flex-col gap-0.5 px-3 pt-1 pb-3" data-tour="sidebar">
            {finalNavItems.map((item, idx) => {
              if (item.type === 'separator') {
                // The first separator sits right below the search bar
                // — without trimming the top padding it leaves a wide
                // gap that makes the section header feel disconnected
                // from the search trigger.
                const isFirstSep = idx === 0
                return (
                  <div key={`sep-${idx}`} className={cn(isFirstSep ? 'pt-1 pb-1 px-3' : 'pt-3 pb-1 px-3')}>
                    <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-sidebar-muted/50">
                      {t(item.labelKey)}
                    </span>
                  </div>
                )
              }

              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              const Icon = item.icon
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  data-tour={`nav-${item.key}`}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 text-[13px] font-medium transition-all rounded-lg px-3 py-2',
                    isActive
                      ? 'bg-primary/[0.08] text-primary'
                      : 'text-sidebar-muted hover:bg-hover hover:text-sidebar-foreground',
                  )}
                >
                  <Icon
                    size={17}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-primary' : 'text-sidebar-muted',
                    )}
                  />
                  <span>{t(`nav.${item.key}`)}</span>
                </Link>
              )
            })}
          </nav>
          </div>

          <UpdateAvailableBanner onOpen={() => setUpdateDialogOpen(true)} />

          {/* Merged account + workspace menu — one trigger at the
              bottom of the sidebar shows the active workspace as the
              primary identity, the user email + role as the secondary
              line, and combines workspace switching with all the
              account actions that used to live in a separate dropdown. */}
          <div className="px-3 pt-1">
            <WorkspaceSwitcher
              backingUp={backingUp}
              onChangePassword={() => setChangePasswordOpen(true)}
              onTwoFactor={() => setTwoFactorOpen(true)}
              onPasskeys={() => setPasskeysOpen(true)}
              onBackup={async () => {
                setBackingUp(true)
                try {
                  await backupApi.download()
                  toast.success(t('backup.success'))
                } catch {
                  toast.error(t('backup.error'))
                } finally {
                  setBackingUp(false)
                }
              }}
              onUpdateAvailable={() => setUpdateDialogOpen(true)}
              agentsEnabled={agentsEnabled}
            />
          </div>

          <div className="px-3 pb-3 pt-1">
            <div
              className="text-[11px] leading-4 text-sidebar-muted/70 text-center"
              role="note"
            >
              <span className="sr-only">{versionA11yLabel}</span>
              <span aria-hidden="true" className="block break-all line-clamp-2">
                {t('app.versionLabel', { version: APP_VERSION })}
              </span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        {/* overflow-x-clip (not hidden): `hidden` forces overflow-y to `auto`
            per CSS's one-axis rule, turning main into its own scroll container
            and reserving a phantom scrollbar gutter on tall pages. clip just
            clips horizontal overflow without that side effect. */}
        <main className="flex-1 min-h-screen overflow-x-clip lg:ml-60">
          {/* Top gap scales gently with width but stays close to the 24px side
              padding (px-6) so it reads even — capped low because vw includes
              the sidebar and would otherwise overshoot on wide screens. */}
          <div className="px-6 pb-6 pt-[clamp(1.5rem,2.2vw,2rem)] max-w-7xl mx-auto">
            {/* Active-collection filter (issue #105): sticky bar above the
                content so the scope is visible right where the data is. */}
            <CollectionSelector variant="header" />
            {/* Local Suspense so a not-yet-loaded page chunk only affects the
                content area — the sidebar/chrome never blanks. PageTransition
                fades the old page out then slides the new one up. */}
            <Suspense fallback={null}>
              <PageTransition />
            </Suspense>
          </div>
        </main>
      </div>

      {showTour && <OnboardingTour onComplete={handleTourComplete} />}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
      <TwoFactorSetup
        open={twoFactorOpen}
        onClose={() => setTwoFactorOpen(false)}
      />
      <PasskeyManagementDialog
        open={passkeysOpen}
        onClose={() => setPasskeysOpen(false)}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {/* Slide-over global chat — opened from the sidebar pill or via
          ⌘J. The previous floating bottom-right button was removed
          since the entry point now lives in the sidebar next to ⌘K. */}
      {agentsEnabled && <GlobalChatPanel open={chatOpen} onOpenChange={setChatOpen} />}
      <UpdateAvailableDialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
      />
    </div>
  )
}

function UserMenu({
  userInitial,
  logout,
  onChangePassword,
  onTwoFactor,
  onPasskeys,
  onBackup,
  backingUp,
  dark,
  isAdmin,
  agentsEnabled,
}: {
  userInitial: string
  logout: () => void
  onChangePassword: () => void
  onTwoFactor: () => void
  onPasskeys: () => void
  onBackup: () => void
  backingUp: boolean
  dark?: boolean
  isAdmin?: boolean
  agentsEnabled?: boolean
}) {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const currentLang = resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className={
                dark
                  ? 'bg-primary/20 text-primary text-xs font-semibold'
                  : 'bg-primary/10 text-primary text-xs font-semibold'
              }
            >
              {userInitial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAdmin && (
          <>
            <DropdownMenuItem
              onClick={() => nav('/admin')}
              className="flex items-center gap-2"
            >
              <Shield size={14} />
              {t('nav.groupAdmin')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={onChangePassword}
          className="flex items-center gap-2"
        >
          <KeyRound size={14} />
          {t('auth.changePassword')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onTwoFactor}
          className="flex items-center gap-2"
        >
          <ShieldCheck size={14} />
          {t('auth.twoFactorTitle')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onPasskeys}
          className="flex items-center gap-2"
        >
          <Fingerprint size={14} />
          {t('auth.passkeysTitle')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={backingUp}
          onClick={onBackup}
          className="flex items-center gap-2"
        >
          <HardDriveDownload size={14} />
          {backingUp ? t('backup.downloading') : t('backup.button')}
        </DropdownMenuItem>
        {agentsEnabled && (
          <DropdownMenuItem
            onClick={() => nav('/agents')}
            className="flex items-center gap-2"
          >
            <Sparkles size={14} />
            {t('nav.aiAgents')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <Languages size={14} />
            <span className="flex-1">{t('setup.language')}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {currentLang.split('-')[0]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-40">
              <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                {t('setup.language')}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('ru')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Русский</span>
                {currentLang === 'ru' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('de')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Deutsch</span>
                {currentLang === 'de' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('uk')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Українська</span>
                {currentLang === 'uk' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('pt-BR')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Português</span>
                {currentLang === 'pt-BR' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('en')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">English</span>
                {currentLang === 'en' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('es')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Español</span>
                {currentLang === 'es' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('pl')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Polski</span>
                {currentLang === 'pl' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage('it')}
                className="flex items-center gap-2"
              >
                <span className="flex-1">Italiano</span>
                {currentLang === 'it' && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-rose-600 focus:text-rose-600"
        >
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
