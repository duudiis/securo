import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { resolveSupportedLang } from '@/lib/i18n'
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
import {
  Check,
  ChevronUp,
  Languages,
  LogOut,
  Repeat,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Tag,
  User as UserIcon,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAvatar } from '@/hooks/use-avatar'
import { CategoryIcon } from '@/components/category-icon'
import type { Workspace } from '@/types'

const ROLE_LABEL_KEY: Record<string, string> = {
  owner: 'workspace.roleOwner',
  editor: 'workspace.roleEditor',
  viewer: 'workspace.roleViewer',
  manager: 'workspace.roleManager',
}

// Fallbacks when a workspace hasn't set its own icon/color yet.
const DEFAULT_ICON_BY_KIND: Record<string, string> = {
  personal: 'user',
  freelancer: 'briefcase',
  small_business: 'building-2',
  accountant_firm: 'landmark',
}
const DEFAULT_COLOR = '#6366F1'

function workspaceIcon(w: Workspace): string {
  return w.icon || DEFAULT_ICON_BY_KIND[w.kind] || 'briefcase'
}
function workspaceColor(w: Workspace): string {
  return w.color || DEFAULT_COLOR
}

interface AccountMenuProps {
  /** True when the AGENTS_ENABLED env flag is on. */
  agentsEnabled: boolean
}

/**
 * Unified account menu: workspace identity on the trigger, all
 * workspace + account actions in one dropdown. Replaces the previous
 * standalone workspace switcher + separate user dropdown.
 *
 * Dialogs (change password, 2FA, update available) stay owned by the
 * parent layout — they're shared with other surfaces and the menu
 * only needs to trigger them.
 */
export function WorkspaceSwitcher({ agentsEnabled }: AccountMenuProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { current, workspaces, switchWorkspace } = useWorkspace()
  const { user, logout } = useAuth()
  const avatarUrl = useAvatar()
  const [menuOpen, setMenuOpen] = useState(false)

  const currentLang = resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language)

  if (!current || !user) return null

  const hasMultipleWorkspaces = workspaces.length > 1
  const roleLabel = current.role && ROLE_LABEL_KEY[current.role]
    ? t(ROLE_LABEL_KEY[current.role])
    : null

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-hover transition-colors text-left focus-visible:outline-none">
            <Avatar className="size-6 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="text-[10px] font-semibold">
                {(user.preferences?.display_name || user.email).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">
                {user.preferences?.display_name || user.email.split('@')[0]}
              </p>
              <p className="text-[10px] text-sidebar-muted/70 truncate">
                {user.email}
                {roleLabel && (
                  <span className="ml-1 uppercase tracking-wide">· {roleLabel}</span>
                )}
              </p>
            </div>
            <ChevronUp size={14} className={`text-sidebar-muted/60 shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64" side="top">
          {/* Workspaces — only show the switcher list when there's more than one. */}
          {hasMultipleWorkspaces && (
            <>
              <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                {t('workspace.switcherTitle', 'Switch workspace')}
              </DropdownMenuLabel>
              {workspaces.map((w) => {
                const isActive = w.id === current.id
                return (
                  <DropdownMenuItem
                    key={w.id}
                    onClick={() => void switchWorkspace(w.id)}
                    className="flex items-center gap-2"
                  >
                    <CategoryIcon
                      icon={workspaceIcon(w)}
                      color={workspaceColor(w)}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate">{w.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {w.role && ROLE_LABEL_KEY[w.role] && t(ROLE_LABEL_KEY[w.role])}
                    </span>
                    {isActive && <Check size={12} className="text-primary ml-1" />}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Account page: profile picture, password, 2FA, passkeys */}
          <DropdownMenuItem
            onClick={() => navigate('/account')}
            className="flex items-center gap-2"
          >
            <UserIcon size={14} />
            {t('nav.account')}
          </DropdownMenuItem>

          {/* Admin (workspace settings + creation live here now) */}
          {user.is_superuser && (
            <DropdownMenuItem
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2"
            >
              <Shield size={14} />
              {t('nav.groupAdmin')}
            </DropdownMenuItem>
          )}

          {/* Setup — the sidebar's former SETUP section, recurring last */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <SlidersHorizontal size={14} />
              <span className="flex-1">{t('nav.groupSetup')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent sideOffset={8} className="w-44">
                <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {t('nav.groupSetup')}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/categories')} className="flex items-center gap-2">
                  <Tag size={14} />
                  {t('nav.categories')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/payees')} className="flex items-center gap-2">
                  <Users size={14} />
                  {t('nav.payees')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/rules')} className="flex items-center gap-2">
                  <SlidersHorizontal size={14} />
                  {t('nav.rules')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/recurring')} className="flex items-center gap-2">
                  <Repeat size={14} />
                  {t('nav.recurring')}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {agentsEnabled && (
            <DropdownMenuItem
              onClick={() => navigate('/agents')}
              className="flex items-center gap-2"
            >
              <Sparkles size={14} />
              {t('nav.aiAgents')}
            </DropdownMenuItem>
          )}

          {/* Language sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <Languages size={14} />
              <span className="flex-1">{t('setup.language')}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {currentLang.split('-')[0]}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent sideOffset={8} className="w-40">
                <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {t('setup.language')}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('ru')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Русский</span>
                  {currentLang === 'ru' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('de')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Deutsch</span>
                  {currentLang === 'de' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('uk')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Українська</span>
                  {currentLang === 'uk' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('pt-BR')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Português</span>
                  {currentLang === 'pt-BR' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('en')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">English</span>
                  {currentLang === 'en' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('es')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Español</span>
                  {currentLang === 'es' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('pl')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Polski</span>
                  {currentLang === 'pl' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => i18n.changeLanguage('it')}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">Italiano</span>
                  {currentLang === 'it' && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={logout}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <LogOut size={14} />
            {t('auth.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  )
}
