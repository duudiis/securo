import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { SkeletonListCard } from '@/components/skeletons'

const CROSSFADE_MS = 350

/**
 * Loading surface with a real crossfade.
 *
 * While `loading`, renders the page's structural skeleton (composed from
 * components/skeletons to mirror the page's known layout). When loading ends
 * the content mounts underneath and the two layers CROSSFADE — the skeleton
 * fades out while the content fades in, no cut. The skeleton only shows for
 * the initial load of a mount; later refetches keep content visible.
 */
export function SkeletonSurface({
  loading,
  skeleton,
  className,
  children,
}: {
  loading: boolean
  /** Structural placeholder mirroring this page's layout. Defaults to a list card. */
  skeleton?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  // revealed: content is (becoming) visible. skeletonGone: overlay unmounted.
  const [revealed, setRevealed] = useState(!loading)
  const [skeletonGone, setSkeletonGone] = useState(!loading)

  // Loading finished → mount content invisible, then crossfade both layers.
  useEffect(() => {
    if (loading || revealed) return
    // Double rAF: the content must paint at opacity 0 before the transition
    // starts, otherwise the fade snaps.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealed(true))
    })
    const timer = setTimeout(() => setSkeletonGone(true), CROSSFADE_MS + 100)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(timer)
    }
  }, [loading, revealed])

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'transition-opacity motion-reduce:transition-none',
          revealed ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
      >
        {!loading || revealed ? children : null}
      </div>

      {!skeletonGone && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none transition-opacity motion-reduce:transition-none',
            // In flow while loading (defines the surface height); overlays the
            // mounting content during the crossfade. Not clipped — a hard
            // bottom chop mid-fade reads as a cut, a fading overhang doesn't.
            revealed ? 'absolute inset-x-0 top-0 opacity-0 z-10' : 'opacity-100',
          )}
          style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
        >
          {skeleton ?? <SkeletonListCard rows={5} />}
        </div>
      )}
    </div>
  )
}
