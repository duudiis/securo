import { useCallback, useState } from 'react'

/** A Set<string> with a stable toggle callback — the expand/collapse state used across grouped views. */
export function useToggleSet(initial?: Iterable<string>) {
  const [set, setSet] = useState<Set<string>>(() => new Set(initial))
  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  return [set, toggle, setSet] as const
}
