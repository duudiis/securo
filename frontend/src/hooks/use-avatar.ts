import { useQuery } from '@tanstack/react-query'
import { avatar as avatarApi } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'

/**
 * The current user's profile picture as a data URL (or null).
 * Fetched through the authenticated API (an <img src> can't send the Bearer
 * header) and cached; invalidate ['avatar'] after upload/remove.
 */
export function useAvatar(): string | null {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['avatar', user?.id],
    enabled: !!user?.has_avatar,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const blob = await avatarApi.get()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    },
  })
  return user?.has_avatar ? (data ?? null) : null
}
