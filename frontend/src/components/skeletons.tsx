import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Structural skeleton building blocks. Each page composes these to mirror its
 * known layout (cards, list rows, tables, stat tiles, charts) so the shimmer
 * matches the real content's structure — deterministic, no measuring.
 */

export function SkeletonCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card rounded-xl border border-border shadow-sm overflow-hidden', className)}>
      {children}
    </div>
  )
}

export function SkeletonCardHeader() {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

/** An icon + two text lines + right-aligned value — the app's list-row shape. */
export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Skeleton className="size-9 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-40 max-w-[50%]" />
        <Skeleton className="h-3 w-24 max-w-[35%]" />
      </div>
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>
  )
}

export function SkeletonListCard({ rows = 5, header = false, className }: { rows?: number; header?: boolean; className?: string }) {
  return (
    <SkeletonCard className={className}>
      {header && <SkeletonCardHeader />}
      <div className="divide-y divide-muted">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonListRow key={i} />
        ))}
      </div>
    </SkeletonCard>
  )
}

/** Table rows without a card wrapper (for surfaces already inside a card). */
export function SkeletonTableRows({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <div className="flex items-center gap-6 px-5 py-3.5 border-b border-border">
        {[24, 40, 64, 32, 40, 24].map((w, i) => (
          <Skeleton key={i} className="h-3" style={{ width: w }} />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 flex-1 max-w-64" />
            <Skeleton className="h-3.5 w-24 ml-auto" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonTableCard({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonCard className={className}>
      <SkeletonTableRows rows={rows} />
    </SkeletonCard>
  )
}

/** A row of KPI/stat tiles (label + big value). */
export function SkeletonStatTiles({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:gap-4', count === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28 max-w-full" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonChartCard({ height = 280, className }: { height?: number; className?: string }) {
  return (
    <SkeletonCard className={className}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="p-4">
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </div>
    </SkeletonCard>
  )
}

/* ── Page composites ─────────────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonCard>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonListCard rows={5} header />
        <SkeletonChartCard height={300} />
      </div>
      <SkeletonTableCard rows={6} />
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonCard>
        <div className="px-5 py-4 flex items-center gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <Skeleton className="w-full rounded-lg" style={{ height: 300 }} />
        </div>
      </SkeletonCard>
      <SkeletonChartCard height={260} />
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonStatTiles count={4} />
      <SkeletonChartCard height={240} />
      <SkeletonListCard rows={5} header />
    </div>
  )
}

export function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonListCard rows={3} />
      <SkeletonListCard rows={3} header />
      <SkeletonTableCard rows={4} />
    </div>
  )
}
