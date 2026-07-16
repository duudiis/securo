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

/** Transactions grid rows (no card — the surface sits inside the table card).
 *  Mirrors the real columns: checkbox · date (110px) · description (big
 *  category icon + text, flex) · category (icon + name, 180px) · account
 *  (icon + name, 160px) · amount (right). Row rhythm matches py-2.5 cells. */
export function SkeletonTableRows({ rows = 10 }: { rows?: number }) {
  return (
    <div>
      {/* Header row */}
      <div className="flex items-center border-b border-border px-0 py-3">
        <div className="w-10 pl-4 shrink-0">
          <Skeleton className="size-4 rounded" />
        </div>
        <Skeleton className="h-3 w-10 ml-2" style={{ marginRight: 68 }} />
        <Skeleton className="h-3 w-24 flex-1 max-w-28" />
        <Skeleton className="h-3 w-16 hidden md:block" style={{ marginRight: 100 }} />
        <Skeleton className="h-3 w-16 hidden lg:block" style={{ marginRight: 80 }} />
        <Skeleton className="h-3 w-14 ml-auto mr-5" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center py-2.5">
            <div className="w-10 pl-4 shrink-0">
              <Skeleton className="size-4 rounded" />
            </div>
            {/* date */}
            <Skeleton className="h-3.5 w-16 ml-2 mr-8 shrink-0" />
            {/* description: category icon + text */}
            <div className="flex items-center gap-3 flex-1 min-w-0 pl-2">
              <Skeleton className="size-9 rounded-xl shrink-0" />
              <Skeleton className="h-3.5" style={{ width: `${52 - (i % 4) * 9}%`, maxWidth: 260 }} />
            </div>
            {/* category: small icon + name */}
            <div className="hidden md:flex items-center gap-2 w-[170px] shrink-0">
              <Skeleton className="size-6 rounded-md shrink-0" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            {/* account: small icon + name */}
            <div className="hidden lg:flex items-center gap-2 w-[150px] shrink-0">
              <Skeleton className="size-6 rounded-md shrink-0" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            {/* amount */}
            <Skeleton className="h-3.5 w-16 ml-auto mr-5 shrink-0" />
          </div>
        ))}
      </div>
    </div>
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
      <SkeletonCard>
        <SkeletonTableRows rows={6} />
      </SkeletonCard>
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
      <SkeletonListCard rows={3} header />
    </div>
  )
}

/** Budgets table: collapsed group rows — chevron + icon + name left, amount right. */
export function BudgetsSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonCardHeader />
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-5 py-3.5">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-24 ml-auto" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}

/** Categories page: group header rows with a couple of indented items each. */
export function CategoriesSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonCardHeader />
      <div>
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/40">
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-8" />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 pl-12 pr-5 py-2.5 border-b border-border">
                <Skeleton className="size-7 rounded-md" />
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-20 ml-auto" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}

/** Payees table: name · type pill · counts · amount. */
export function PayeesSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-6 px-4 py-3 border-b border-border">
        <Skeleton className="h-3 w-24 flex-1 max-w-48" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10 hidden sm:block" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3.5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-40 max-w-[60%]" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-10 hidden sm:block" />
            <Skeleton className="h-3.5 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}
