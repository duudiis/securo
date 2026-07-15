/**
 * Self-maintaining skeleton geometry.
 *
 * After a page's real content renders, `captureSnapshot` walks its DOM and
 * records the rectangles of the visible leaf elements (text, buttons, inputs,
 * icons, charts). The snapshot is persisted per page + container width, and
 * the next visit replays those exact rects as shimmer blocks — so skeletons
 * match the real layout pixel-for-pixel and update themselves whenever the
 * UI changes. No hand-built skeleton mockups to maintain.
 */

export interface SkeletonRect {
  x: number
  y: number
  w: number
  h: number
  /** border radius, px */
  r: number
}

export interface SkeletonSnapshot {
  v: number
  /** captured content height, px (capped) */
  h: number
  rects: SkeletonRect[]
}

const VERSION = 1
const STORAGE_PREFIX = 'securo.skeleton'
// Geometry below the first ~2 viewports never shows during load — skip it to
// keep snapshots small.
const MAX_CAPTURE_HEIGHT = 2400
const MAX_RECTS = 400
// Containers narrower/wider than the stored bucket by half a step reuse the
// nearest snapshot; layout shifts of a few px are invisible in a shimmer.
const WIDTH_BUCKET = 32

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
// Elements captured as a single block even when they have children — their
// internals (chart geometry, button labels) read as one visual unit.
const ATOMIC_TAGS = new Set(['svg', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'IMG', 'VIDEO', 'CANVAS', 'TABLE'])

function storageKey(pageKey: string, width: number): string {
  return `${STORAGE_PREFIX}.v${VERSION}.${pageKey}.${Math.round(width / WIDTH_BUCKET)}`
}

export function loadSnapshot(pageKey: string, width: number): SkeletonSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(pageKey, width))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SkeletonSnapshot
    if (parsed.v !== VERSION || !Array.isArray(parsed.rects) || parsed.rects.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSnapshot(pageKey: string, width: number, snapshot: SkeletonSnapshot): void {
  try {
    localStorage.setItem(storageKey(pageKey, width), JSON.stringify(snapshot))
  } catch {
    // Quota exceeded / private mode — skeletons just fall back next visit.
  }
}

export function captureSnapshot(root: HTMLElement): SkeletonSnapshot | null {
  const rootRect = root.getBoundingClientRect()
  if (rootRect.width < 50 || rootRect.height < 20) return null

  const rects: SkeletonRect[] = []

  const push = (el: Element, r: DOMRect) => {
    const radius = parseFloat(getComputedStyle(el).borderRadius) || 4
    rects.push({
      x: Math.round(r.left - rootRect.left),
      y: Math.round(r.top - rootRect.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      r: Math.round(Math.min(radius, r.height / 2)),
    })
  }

  const walk = (el: Element): void => {
    if (rects.length >= MAX_RECTS || SKIP_TAGS.has(el.tagName)) return
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return
    const r = el.getBoundingClientRect()
    if (r.width < 3 || r.height < 3) return
    if (r.top - rootRect.top > MAX_CAPTURE_HEIGHT) return
    if (r.bottom < rootRect.top) return

    if (ATOMIC_TAGS.has(el.tagName)) {
      push(el, r)
      return
    }
    if (el.childElementCount === 0) {
      // Leaf: capture only if it draws something (text or its own background).
      const hasText = !!el.textContent && el.textContent.trim().length > 0
      const hasBackground =
        style.backgroundImage !== 'none' ||
        (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent')
      if (hasText || hasBackground) push(el, r)
      return
    }
    for (const child of Array.from(el.children)) walk(child)
  }

  for (const child of Array.from(root.children)) walk(child)
  if (rects.length === 0) return null

  return {
    v: VERSION,
    h: Math.round(Math.min(rootRect.height, MAX_CAPTURE_HEIGHT)),
    rects,
  }
}
