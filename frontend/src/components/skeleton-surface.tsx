import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  captureSnapshot,
  loadSnapshot,
  saveSnapshot,
  type SkeletonSnapshot,
} from '@/lib/skeleton-snapshot'

const CROSSFADE_MS = 350
// Wait for charts/async widgets to settle before photographing the layout.
const CAPTURE_DELAY_MS = 900

/**
 * Loading surface with self-maintaining, pixel-accurate skeletons.
 *
 * While `loading`, replays the geometry captured from this page's last real
 * render as shimmer blocks (see lib/skeleton-snapshot). When loading ends the
 * content mounts underneath and the two layers CROSSFADE — skeleton fades out
 * while content fades in, no cut. After the reveal the freshly rendered
 * layout is re-captured, so the skeleton always tracks the current UI.
 *
 * The skeleton only shows for the initial load of a mount; later refetches
 * (pagination, filter changes) keep the content visible.
 */
export function SkeletonSurface({
  pageKey,
  loading,
  className,
  children,
}: {
  pageKey: string
  loading: boolean
  className?: string
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<SkeletonSnapshot | null>(null)
  // Whether this mount ever showed a skeleton (loading on first paint).
  const startedLoadingRef = useRef(loading)
  // revealed: content is (becoming) visible. skeletonGone: overlay unmounted.
  const [revealed, setRevealed] = useState(!loading)
  const [skeletonGone, setSkeletonGone] = useState(!loading)

  // Look up the stored geometry for this page at the current width.
  useLayoutEffect(() => {
    if (!startedLoadingRef.current) return
    const width = containerRef.current?.getBoundingClientRect().width ?? 0
    setSnapshot(loadSnapshot(pageKey, width))
  }, [pageKey])

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

  // Re-photograph the real layout after every reveal so the next visit's
  // skeleton matches the UI as it is today.
  useEffect(() => {
    if (!revealed || loading) return
    const timer = setTimeout(() => {
      const container = containerRef.current
      const content = contentRef.current
      if (!container || !content) return
      const snap = captureSnapshot(content)
      if (snap) saveSnapshot(pageKey, container.getBoundingClientRect().width, snap)
    }, CAPTURE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [revealed, loading, pageKey])

  const mountContent = !loading || revealed

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={!skeletonGone ? { minHeight: snapshot?.h ?? 320 } : undefined}
    >
      <div
        ref={contentRef}
        className={cn(
          'transition-opacity motion-reduce:transition-none',
          revealed ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
      >
        {mountContent ? children : null}
      </div>

      {!skeletonGone && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-0 overflow-hidden pointer-events-none z-10',
            'transition-opacity motion-reduce:transition-none',
            revealed ? 'opacity-0' : 'opacity-100',
          )}
          style={{ transitionDuration: `${CROSSFADE_MS}ms`, height: snapshot?.h ?? 320 }}
        >
          {snapshot ? (
            snapshot.rects.map((r, i) => (
              <div
                key={i}
                className="absolute bg-accent animate-pulse"
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r }}
              />
            ))
          ) : (
            // First-ever visit: no geometry yet — generic placeholder rows.
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-accent animate-pulse" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
