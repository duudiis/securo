import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Fingerprint, KeyRound, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { auth as authApi, avatar as avatarApi } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { useAvatar } from '@/hooks/use-avatar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { TwoFactorSetup } from '@/components/two-factor-setup'
import { PasskeyManagementDialog } from '@/components/passkey-management-dialog'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function AccountPage() {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()
  const avatarUrl = useAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(user?.preferences?.display_name ?? '')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [passkeysOpen, setPasskeysOpen] = useState(false)

  const refreshUser = async () => {
    const me = await authApi.me()
    updateUser(me)
    queryClient.invalidateQueries({ queryKey: ['avatar'] })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => avatarApi.upload(file),
    onSuccess: async () => {
      await refreshUser()
      toast.success(t('account.pictureUpdated'))
    },
    onError: () => toast.error(t('common.error')),
  })

  const removeMutation = useMutation({
    mutationFn: () => avatarApi.remove(),
    onSuccess: async () => {
      await refreshUser()
      toast.success(t('account.pictureRemoved'))
    },
    onError: () => toast.error(t('common.error')),
  })

  const nameMutation = useMutation({
    mutationFn: async () => {
      const prefs = { ...(user?.preferences ?? {}), display_name: displayName.trim() }
      return authApi.updateMe({ preferences: prefs })
    },
    onSuccess: (updated) => {
      updateUser(updated)
      toast.success(t('account.profileSaved'))
    },
    onError: () => toast.error(t('common.error')),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t('account.pictureInvalid'))
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('account.pictureTooLarge'))
      return
    }
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  if (!user) return null
  const initial = (user.preferences?.display_name || user.email).charAt(0).toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader section={t('nav.account')} title={t('nav.account')} />

      <SectionCard title={t('account.profileSection')}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Profile picture */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <Avatar className="size-24">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                disabled={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} />
                {t('account.uploadPicture')}
              </Button>
              {user.has_avatar && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-8 text-muted-foreground hover:text-rose-500"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate()}
                >
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center max-w-[180px]">
              {t('account.pictureHint')}
            </p>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 space-y-4 w-full">
            <div className="space-y-2">
              <Label>{t('accounts.displayName')}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.email.split('@')[0]}
                maxLength={100}
                className="max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('account.email')}</Label>
              <Input value={user.email} disabled className="max-w-sm" />
            </div>
            <Button
              size="sm"
              disabled={nameMutation.isPending || (user.preferences?.display_name ?? '') === displayName.trim()}
              onClick={() => nameMutation.mutate()}
            >
              {nameMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('account.securitySection')}>
        <div className="divide-y divide-border -m-5">
          <button
            className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-hover transition-colors"
            onClick={() => setChangePasswordOpen(true)}
          >
            <KeyRound size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground">{t('auth.changePassword')}</span>
          </button>
          <button
            className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-hover transition-colors"
            onClick={() => setTwoFactorOpen(true)}
          >
            <ShieldCheck size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground flex-1">{t('auth.twoFactorTitle')}</span>
            {user.is_2fa_enabled && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                {t('account.enabled')}
              </span>
            )}
          </button>
          <button
            className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-hover transition-colors"
            onClick={() => setPasskeysOpen(true)}
          >
            <Fingerprint size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground">{t('auth.passkeysTitle')}</span>
          </button>
        </div>
      </SectionCard>

      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <TwoFactorSetup open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />
      <PasskeyManagementDialog open={passkeysOpen} onClose={() => setPasskeysOpen(false)} />
    </div>
  )
}
