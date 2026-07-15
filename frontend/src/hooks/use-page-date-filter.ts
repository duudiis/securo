import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pageSettings, type PageSettingPayload } from '@/lib/api'
import { useWorkspace } from '@/contexts/workspace-context'
import {
  parseDateFilterValue,
  resolveDateRange,
  type DateFilterValue,
  type DateRange,
} from '@/lib/date-filter'

/**
 * The page's date-filter value, backed by the per-page cloud settings
 * (page_settings table). Reads resolve as: user's in-session pick →
 * cloud-saved value → page default. Every pick is saved back under the
 * page's key, so the page reopens on the last filter.
 *
 * `isLoaded` turns true once the cloud lookup settles — pages that want to
 * avoid a default-window flash can gate their data query on it.
 */
export function usePageDateFilter(pageKey: string, defaultValue: DateFilterValue) {
  const queryClient = useQueryClient()
  const { current } = useWorkspace()
  const [local, setLocal] = useState<DateFilterValue | null>(null)

  // Workspace switch resets react-query caches; the in-session pick must not
  // bleed into the next workspace either.
  useEffect(() => {
    setLocal(null)
  }, [current?.id, pageKey])

  const { data, isPending } = useQuery({
    queryKey: ['page-settings', pageKey],
    queryFn: () => pageSettings.get(pageKey),
    staleTime: 5 * 60 * 1000,
  })

  const saved = parseDateFilterValue(data?.settings?.dateFilter)
  const value: DateFilterValue = local ?? saved ?? defaultValue

  const saveMutation = useMutation({
    mutationFn: (next: DateFilterValue) =>
      pageSettings.put(pageKey, { ...(data?.settings ?? {}), dateFilter: next }),
    onSuccess: (resp: PageSettingPayload) => {
      queryClient.setQueryData(['page-settings', pageKey], resp)
    },
  })

  const setValue = useCallback(
    (next: DateFilterValue) => {
      setLocal(next)
      saveMutation.mutate(next)
    },
    [saveMutation.mutate],
  )

  const range: DateRange = resolveDateRange(value)

  return { value, setValue, range, isLoaded: !isPending }
}
