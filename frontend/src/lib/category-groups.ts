import type { Category, CategoryGroup } from '@/types'

// Sentinel bucket id for categories without a group. Real group ids are UUIDs,
// so this can never collide.
export const UNGROUPED_ID = 'ungrouped'

export interface GroupBucket {
  id: string
  name: string
  icon: string
  color: string
  position: number
  isUngrouped: boolean
  categoryIds: string[]
}

export interface CategoryGroupIndex {
  /** All buckets ordered by group position, with the ungrouped bucket last. */
  buckets: GroupBucket[]
  bucketByCategoryId: Map<string, GroupBucket>
  bucketById: Map<string, GroupBucket>
}

/**
 * Build a category-id -> group lookup from the /category-groups response
 * (groups carry their nested categories) plus the flat /categories list,
 * which is the source of truth for ungrouped categories.
 * The ungrouped bucket's name is empty — render it with t('groups.noGroup').
 */
export function buildCategoryGroupIndex(
  groups: CategoryGroup[] | undefined,
  categories: Category[] | undefined,
): CategoryGroupIndex {
  const buckets: GroupBucket[] = (groups ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      color: g.color,
      position: g.position,
      isUngrouped: false,
      categoryIds: (g.categories ?? []).map((c) => c.id),
    }))

  const ungrouped: GroupBucket = {
    id: UNGROUPED_ID,
    name: '',
    icon: 'folder',
    color: '#6B7280',
    position: Number.MAX_SAFE_INTEGER,
    isUngrouped: true,
    categoryIds: [],
  }

  const bucketByCategoryId = new Map<string, GroupBucket>()
  for (const bucket of buckets) {
    for (const catId of bucket.categoryIds) bucketByCategoryId.set(catId, bucket)
  }
  for (const c of categories ?? []) {
    if (!bucketByCategoryId.has(c.id)) {
      ungrouped.categoryIds.push(c.id)
      bucketByCategoryId.set(c.id, ungrouped)
    }
  }
  buckets.push(ungrouped)

  return {
    buckets,
    bucketByCategoryId,
    bucketById: new Map(buckets.map((b) => [b.id, b])),
  }
}

export interface GroupedRows<T> {
  bucket: GroupBucket
  rows: T[]
}

export interface GroupRollup<T> {
  /** Buckets that have at least one row, in bucket order. */
  groups: GroupedRows<T>[]
  /** Rows whose category id is null/undefined (uncategorized ≠ ungrouped). */
  uncategorized: T[]
}

export function rollupByGroup<T>(
  rows: T[],
  categoryIdOf: (row: T) => string | null | undefined,
  index: CategoryGroupIndex,
): GroupRollup<T> {
  const byBucket = new Map<string, GroupedRows<T>>()
  const uncategorized: T[] = []
  const ungroupedBucket = index.bucketById.get(UNGROUPED_ID)!

  for (const row of rows) {
    const catId = categoryIdOf(row)
    if (!catId) {
      uncategorized.push(row)
      continue
    }
    const bucket = index.bucketByCategoryId.get(catId) ?? ungroupedBucket
    let entry = byBucket.get(bucket.id)
    if (!entry) {
      entry = { bucket, rows: [] }
      byBucket.set(bucket.id, entry)
    }
    entry.rows.push(row)
  }

  return {
    groups: index.buckets.filter((b) => byBucket.has(b.id)).map((b) => byBucket.get(b.id)!),
    uncategorized,
  }
}
