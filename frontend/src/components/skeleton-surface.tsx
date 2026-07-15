import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { SkeletonListCard } from '@/components/skeletons'

const CROSSFADE_MS = 250
// Once a skeleton has been shown, keep it up at least this long — a
// few-ms flash on fast connections reads as flicker.
const MIN_SKELETON_MS = 650

/**
 * Loading surface, two modes:
 *
 * `mask` (preferred): the page renders its REAL components with placeholder
 * data while loading; this wrapper applies the [data-skeletonize] CSS mask
 * (see index.css) that turns every text/icon leaf into a shimmer bar in
 * place. The skeleton is the page's own markup — pixel-identical by
 * construction, maintained automatically. On reveal the mask lifts with
 * per-element transitions (bars fade out as real content fades in).
 *
 * Overlay (legacy, `skeleton` prop): a structural placeholder rendered while
 * loading, crossfaded with the mounting content. Used by chart-heavy pages
 * whose content can't render meaningfully from placeholders.
 *
 * Either way the skeleton only shows for the initial load of a mount; later
 * refetches keep content visible (remount with a `key` to re-skeleton).
 */
export function SkeletonSurface({
  loading,
  mask = false,
  skeleton,
  className,
  children,
}: {
  loading: boolean
  /** Mask mode: children render placeholder data and get skeletonized in place. */
  mask?: boolean
  /** Overlay mode: structural placeholder mirroring this page's layout. */
  skeleton?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  // masked → revealing (crossfade running) → done
  const [phase, setPhase] = useState<'masked' | 'revealing' | 'done'>(loading ? 'masked' : 'done')
  const skeletonShownAtRef = useRef<number | null>(null)

  // Stamp when the skeleton first became visible (declared before the reveal
  // effect so the stamp exists by the time the reveal reads it).
  useEffect(() => {
    if (loading && skeletonShownAtRef.current === null) {
      skeletonShownAtRef.current = Date.now()
    }
  }, [loading])

  // Loading finished → wait out the minimum display time, then crossfade.
  useEffect(() => {
    if (loading || phase !== 'masked') return
    const shownAt = skeletonShownAtRef.current
    const wait = shownAt ? Math.max(0, MIN_SKELETON_MS - (Date.now() - shownAt)) : 0
    let raf1 = 0
    let raf2 = 0
    // Double rAF: content must paint in its pre-reveal state before the
    // transition starts, otherwise the fade snaps.
    const delay = setTimeout(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase('revealing'))
      })
    }, wait)
    return () => {
      clearTimeout(delay)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [loading, phase])

  useEffect(() => {
    if (phase !== 'revealing') return
    const timer = setTimeout(() => setPhase('done'), CROSSFADE_MS + 150)
    return () => clearTimeout(timer)
  }, [phase])

  if (mask) {
    return (
      <div
        className={className}
        data-skeletonize={phase === 'masked' ? '' : undefined}
        data-skeleton-reveal={phase !== 'done' ? '' : undefined}
        aria-busy={phase === 'masked' || undefined}
      >
        {children}
      </div>
    )
  }

  const revealed = phase !== 'masked'
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

      {phase !== 'done' && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none transition-opacity motion-reduce:transition-none',
            // In flow while loading (defines the surface height); becomes an
            // overlay the moment content mounts underneath. Not clipped — a
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
