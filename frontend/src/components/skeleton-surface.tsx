import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { SkeletonListCard } from '@/components/skeletons'

const CROSSFADE_MS = 250
// Once a skeleton has been shown, keep it up at least this long — a
// few-ms flash on fast connections reads as flicker.
const MIN_SKELETON_MS = 650

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
  const skeletonShownAtRef = useRef<number | null>(null)

  // Stamp when the skeleton first became visible (declared before the reveal
  // effect so the stamp exists by the time the reveal reads it).
  useEffect(() => {
    if (loading && skeletonShownAtRef.current === null) {
      skeletonShownAtRef.current = Date.now()
    }
  }, [loading])

  // Loading finished → wait out the skeleton's minimum display time, then
  // mount content invisible and crossfade both layers.
  useEffect(() => {
    if (loading || revealed) return
    const shownAt = skeletonShownAtRef.current
    const wait = shownAt ? Math.max(0, MIN_SKELETON_MS - (Date.now() - shownAt)) : 0
    let raf1 = 0
    let raf2 = 0
    // Double rAF: the content must paint at opacity 0 before the transition
    // starts, otherwise the fade snaps.
    const delay = setTimeout(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setRevealed(true))
      })
    }, wait)
    const timer = setTimeout(() => setSkeletonGone(true), wait + CROSSFADE_MS + 150)
    return () => {
      clearTimeout(delay)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(timer)
    }
  }, [loading, revealed])

  const contentMounted = !loading || revealed

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'transition-opacity motion-reduce:transition-none',
          revealed ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
      >
        {contentMounted ? children : null}
      </div>

      {!skeletonGone && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none transition-opacity motion-reduce:transition-none',
            // In flow while loading (defines the surface height); becomes an
            // overlay the moment content mounts underneath (which may be
            // before the reveal — the skeleton holds its minimum display
            // time on top of the already-mounted content). Not clipped — a
            // hard bottom chop mid-fade reads as a cut, a fading overhang
            // doesn't. The pulse freezes during the fade: children animating
            // opacity against the fading overlay reads as flicker.
            contentMounted && 'absolute inset-x-0 top-0 z-10',
            revealed
              ? 'opacity-0 [&_[data-slot=skeleton]]:animate-none'
              : 'opacity-100',
          )}
          style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
        >
          {skeleton ?? <SkeletonListCard rows={5} />}
        </div>
      )}
    </div>
  )
}
