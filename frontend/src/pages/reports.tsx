import { useState, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDisplayLocale } from '@/hooks/use-display-locale'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { ChevronDown, ChevronRight, HelpCircle, X } from 'lucide-react'
import { categories as categoriesApi, categoryGroups as categoryGroupsApi, reports } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PageHeader } from '@/components/page-header'
import { CashflowSankey } from '@/components/reports/CashflowSankey'
import { usePrivacyMode } from '@/hooks/use-privacy-mode'
import { useAuth } from '@/contexts/auth-context'
import { useCollectionFilter } from '@/contexts/collection-filter-context'
import type { ReportResponse, CategoryTrendItem, ReportDataPoint } from '@/types'
import { useToggleSet } from '@/hooks/use-toggle-set'
import { buildCategoryGroupIndex, type GroupBucket } from '@/lib/category-groups'
import { DateRangeFilter } from '@/components/date-range-filter'
import { SkeletonSurface } from '@/components/skeleton-surface'
import { ReportsSkeleton } from '@/components/skeletons'
import { usePageDateFilter } from '@/hooks/use-page-date-filter'
import { resolveDateRange, type DateFilterValue } from '@/lib/date-filter'

// A small qualitative palette of well-separated hues for the composition
// detail ring. Capped to a handful of slices, distinct colours make each
// holding easy to match against its legend entry (which a same-hue ramp
// across 15+ near-identical slices never could).
const SLICE_COLORS = [
  '#6366F1', // indigo
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EC4899', // pink
  '#0EA5E9', // sky
  '#8B5CF6', // violet
  '#F97316', // orange
  '#14B8A6', // teal
  '#84CC16', // lime
  '#D946EF', // fuchsia
  '#F43F5E', // rose
  '#06B6D4', // cyan
]
const OTHER_SLICE_COLOR = '#9CA3AF'

function formatCurrency(value: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

function formatCompact(value: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

// Element-wise sum of several trend series, keyed by date (series from the
// same report share the interval, but a map keeps this safe regardless).
function sumTrendSeries(seriesList: ReportDataPoint[][]): ReportDataPoint[] {
  const byDate = new Map<string, number>()
  for (const series of seriesList) {
    for (const p of series) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value)
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value, breakdowns: {}, change: null }))
}



// `days` (when set) asks for an exact rolling window ending today rather than
// the month-aligned window `months` produces.
type RangeOption = { key: string; months: number; period?: 'ytd'; days?: number }

// Historical tabs use the global DateRangeFilter (cloud-persisted per tab);
// only the forward-looking cash-flow horizon keeps preset pills.
const REPORT_DATE_DEFAULTS: Record<string, DateFilterValue> = {
  net_worth: { mode: 'rolling', unit: 'months', count: 12 },
  income_expenses: { mode: 'rolling', unit: 'months', count: 12 },
  money_map: { mode: 'rolling', unit: 'months', count: 3 },
}

const FORWARD_RANGE_OPTIONS: readonly RangeOption[] = [
  { key: '3m', months: 3 },
  { key: '6m', months: 6 },
  { key: '12m', months: 12 },
]

const HISTORICAL_INTERVAL_OPTIONS = [
  { key: 'daily', value: 'daily' },
  { key: 'weekly', value: 'weekly' },
  { key: 'monthly', value: 'monthly' },
  { key: 'yearly', value: 'yearly' },
] as const

const CASH_FLOW_INTERVAL_OPTIONS = [
  { key: 'daily', value: 'daily' },
  { key: 'weekly', value: 'weekly' },
  { key: 'monthly', value: 'monthly' },
] as const

const INTERVAL_LABELS: Record<string, string> = {
  daily: 'intervalDaily',
  weekly: 'intervalWeekly',
  monthly: 'intervalMonthly',
  yearly: 'intervalYearly',
}

const RANGE_LABELS: Record<string, string> = {
  '30d': 'range30d',
  '3m': 'range3m',
  '6m': 'range6m',
  '1y': 'range1y',
  ytd: 'rangeYtd',
  '12m': 'range12m',
  '2y': 'range2y',
}

interface ReportTab {
  key: string
  labelKey: string
  enabled: boolean
}

const REPORT_TABS: ReportTab[] = [
  { key: 'net_worth', labelKey: 'reports.netWorth', enabled: true },
  { key: 'income_expenses', labelKey: 'reports.incomeExpenses', enabled: true },
  { key: 'cash_flow', labelKey: 'reports.cashFlow', enabled: true },
  { key: 'money_map', labelKey: 'reports.moneyMap', enabled: true },
]

export default function ReportsPage() {
  const { t } = useTranslation()
  const { mask, privacyMode, MASK } = usePrivacyMode()
  const { user } = useAuth()
  const userCurrency = user?.preferences?.currency_display ?? 'USD'
  const locale = useDisplayLocale()

  const [rangeKey, setRangeKey] = useState('1y')
  const [interval, setInterval] = useState('monthly')
  const [activeTab, setActiveTab] = useState('net_worth')
  const [compositionView, setCompositionView] = useState<string>('netWorth')
  const [sparklineView, setSparklineView] = useState<'byExpenses' | 'byIncome'>('byExpenses')
  const [sparklinePage, setSparklinePage] = useState(0)
  const [cashFlowBaseline, setCashFlowBaseline] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // Active Collection filter (issue #105): scope all report tabs to its
  // accounts; net worth also includes the collection's wallets' assets.
  const { activeAccountIds, activeWalletIds } = useCollectionFilter()
  const acctIds = activeAccountIds ?? undefined
  const walletIds = activeWalletIds ?? undefined
  // Wallet-only collection (active, zero accounts): the account-based reports
  // (income/expenses, cash flow) have no data — only net worth (which includes
  // the wallets' assets) is meaningful.
  const noAccounts = activeAccountIds !== null && activeAccountIds.length === 0

  const currentTab = REPORT_TABS.find((tab) => tab.key === activeTab) ?? REPORT_TABS[0]

  // Tab-specific document title (Net Worth, Cash Flow, Money Map, ...).
  useLayoutEffect(() => {
    document.title = `${t(currentTab.labelKey)} · Securo`
  }, [currentTab.labelKey, t])

  const isCashFlow = activeTab === 'cash_flow'
  // The Money Map (Sankey) tab is driven by the same income/expenses
  // composition, aggregated over the selected historical range.
  const isMoneyMap = activeTab === 'money_map'
  const intervalOptions = isCashFlow ? CASH_FLOW_INTERVAL_OPTIONS : HISTORICAL_INTERVAL_OPTIONS
  // Cash-flow horizon (forward projection) — the only tab still on pills.
  const selectedRange = FORWARD_RANGE_OPTIONS.find((r) => r.key === rangeKey) ?? FORWARD_RANGE_OPTIONS[1]
  const months = selectedRange.months

  // Global date filter for the historical tabs, cloud-persisted per tab.
  const dateFilter = usePageDateFilter(
    `reports.${activeTab}`,
    REPORT_DATE_DEFAULTS[activeTab] ?? { mode: 'rolling', unit: 'months', count: 12 },
  )

  const windowDays = (v: DateFilterValue): number => {
    const r = resolveDateRange(v)
    if (!r.from || !r.to) return Infinity
    return (new Date(r.to + 'T00:00:00').getTime() - new Date(r.from + 'T00:00:00').getTime()) / 86_400_000 + 1
  }

  const handleDateFilterChange = (v: DateFilterValue) => {
    dateFilter.setValue(v)
    setSelectedDate(null)
    // Auto-fit the interval to the window in both directions — daily for a
    // couple of weeks, weekly up to ~a quarter, monthly up to ~2 years,
    // yearly beyond. The splitter still lets the user override afterwards.
    const d = windowDays(v)
    const fitted = d <= 21 ? 'daily' : d <= 92 ? 'weekly' : d <= 730 ? 'monthly' : 'yearly'
    if (interval !== fitted) setInterval(fitted)
  }

  // Map the filter value onto the report API's params. Rolling windows map to
  // the native months/days/period params; whole-month and custom picks (and
  // rolling windows beyond the API's 24-month cap) use the from/to override.
  const reportParams = (() => {
    const v = dateFilter.value
    switch (v.mode) {
      case 'rolling': {
        if (v.unit === 'days') return { months: 1, period: undefined, days: v.count, window: undefined }
        const m = v.unit === 'months' ? v.count : v.count * 12
        return m <= 24
          ? { months: m, period: undefined, days: undefined, window: undefined }
          : { months: 24, period: undefined, days: undefined, window: resolveDateRange(v) }
      }
      case 'ytd':
        return { months: 12, period: 'ytd' as const, days: undefined, window: undefined }
      default:
        return { months: 1, period: undefined, days: undefined, window: resolveDateRange(v) }
    }
  })()

  // Sliding tab underline + directional content slide.
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right')
  useLayoutEffect(() => {
    const el = tabBarRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`)
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  const handleSelectTab = (key: string) => {
    if (key === activeTab) return
    const order = REPORT_TABS.map((tab) => tab.key)
    setSlideDir(order.indexOf(key) > order.indexOf(activeTab) ? 'right' : 'left')
    setActiveTab(key)
    setCompositionView(key === 'net_worth' ? 'netWorth' : 'net')
    setSparklinePage(0)
    setSelectedDate(null)
    // Clamp the cash-flow horizon/interval to options that tab supports
    if (key === 'cash_flow') {
      if (!FORWARD_RANGE_OPTIONS.some((r) => r.key === rangeKey)) setRangeKey('6m')
      if (!CASH_FLOW_INTERVAL_OPTIONS.some((i) => i.value === interval)) setInterval('daily')
    }
  }

  const { data, isLoading } = useQuery<ReportResponse>({
    queryKey: ['reports', activeTab, isCashFlow ? rangeKey : JSON.stringify(dateFilter.value), interval, isCashFlow ? cashFlowBaseline : false, activeAccountIds, activeWalletIds],
    queryFn: () =>
      isCashFlow
        ? reports.cashFlow(months, interval, cashFlowBaseline, acctIds)
        : activeTab === 'income_expenses' || isMoneyMap
          ? reports.incomeExpenses(reportParams.months, interval, acctIds, reportParams.period, reportParams.days, reportParams.window)
          : reports.netWorth(
              reportParams.months, interval, acctIds, walletIds, reportParams.period,
              // net-worth has no native `days` param — rolling-days windows go
              // through the from/to override instead.
              reportParams.days ? resolveDateRange(dateFilter.value) : reportParams.window,
            ),
    enabled: currentTab.enabled && !(noAccounts && activeTab !== 'net_worth') && (isCashFlow || dateFilter.isLoaded),
  })

  // Category-group rollup: composition/trend keys are category UUIDs on the
  // income-expenses and cash-flow reports, mapped to their group client-side.
  const { data: categoriesList } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })
  const { data: categoryGroupsList } = useQuery({
    queryKey: ['categoryGroups'],
    queryFn: categoryGroupsApi.list,
  })
  const [expandedCatGroups, toggleCatGroup] = useToggleSet()
  const groupIndex = buildCategoryGroupIndex(categoryGroupsList, categoriesList)
  const isCategoryReport = activeTab === 'income_expenses' || activeTab === 'cash_flow' || isMoneyMap

  const summary = data?.summary
  const trend = data?.trend ?? []
  const meta = data?.meta

  // For cash flow we split the line at `forecast_start_date` so the past
  // section renders solid and the forward projection renders dashed.
  // The boundary point is duplicated in both series so the line visually
  // connects without a gap.
  const forecastStart = meta?.forecast_start_date ?? null
  const NEGATIVE_SERIES = new Set(['liabilities'])

  const chartData = trend.map((dp) => {
    const isPast = forecastStart ? dp.date < forecastStart : false
    const isBoundary = forecastStart ? dp.date === forecastStart : false
    const breakdowns = meta?.type === 'net_worth'
      ? Object.fromEntries(Object.entries(dp.breakdowns).map(([k, v]) => [k, NEGATIVE_SERIES.has(k) ? -v : v]))
      : dp.breakdowns
    return {
      date: dp.date,
      value: dp.value,
      change: dp.change ?? null,
      valuePast: isPast || isBoundary ? dp.value : null,
      valueForecast: !isPast ? dp.value : null,
      ...breakdowns,
    } as Record<string, string | number | null>
  })

  const allBreakdowns = summary?.breakdowns ?? []
  const breakdownData = allBreakdowns.filter((b) => b.value > 0)

  const colorMap: Record<string, string> = {}
  for (const b of allBreakdowns) {
    colorMap[b.key] = b.color
  }

  const snapshotTrendPoint = selectedDate
    ? (trend.find((dp) => dp.date === selectedDate) ?? null)
    : null
  const isHistoricalSnapshot =
    snapshotTrendPoint !== null &&
    selectedDate !== trend[trend.length - 1]?.date

  const snapshotBreakdownData = snapshotTrendPoint
    ? Object.entries(snapshotTrendPoint.breakdowns)
        .map(([key, rawValue]) => {
          const orig = allBreakdowns.find((b) => b.key === key)
          return {
            key,
            label: orig?.label ?? key,
            value: Math.abs(rawValue as number),
            color: orig?.color ?? '#6366F1',
          }
        })
        .filter((b) => b.value > 0)
    : null

  const compositionBreakdownData = snapshotBreakdownData ?? breakdownData

  const changePrefix = (summary?.change_amount ?? 0) >= 0 ? '+' : ''
  const changeColor = (summary?.change_amount ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-500'

  const tooltipStyle = {
    background: 'var(--card)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '12px',
  }

  const composition = data?.composition ?? []

  // Composition toggle options per report type
  const compositionOptions = activeTab === 'net_worth'
    ? ['netWorth', 'assetsAndAccounts', 'liabilities'] as const
    : activeTab === 'income_expenses' || activeTab === 'cash_flow'
      ? ['net', 'byIncome', 'byExpenses'] as const
      : ['summary', 'detailed'] as const

  // Which breakdown groups are visible in each toggle state. null = show all.
  const activeCompositionGroups: Set<string> | null = (() => {
    if (compositionView === 'assetsAndAccounts') return new Set(['accounts', 'assets'])
    if (compositionView === 'liabilities') return new Set(['liabilities'])
    if (compositionView === 'byIncome') return new Set(['income'])
    if (compositionView === 'byExpenses') return new Set(['expenses'])
    return null
  })()


  // Normalize a breakdown key to its composition group. Cash flow exposes its
  // income/expense breakdowns under projected* keys, but composition items are
  // tagged with the plain group, so the two must be reconciled to line up.
  const groupOf = (key: string) =>
    key === 'projectedIncome' ? 'income'
      : key === 'projectedExpenses' ? 'expenses'
        : key

  // Inner ring — summary view (high-level breakdown), filtered by toggle state for net_worth
  const innerDonutData = (() => {
    const excludedKeys = new Set(['netIncome', 'startingBalance', 'endingBalance'])
    return compositionBreakdownData
      .filter((b) => !excludedKeys.has(b.key) && (!activeCompositionGroups || activeCompositionGroups.has(groupOf(b.key))))
      .map((b) => ({
        name: t(`reports.${b.key}`, { defaultValue: b.label }),
        value: b.value,
        color: b.color,
      }))
  })()

  const activeComposition = snapshotTrendPoint?.composition ?? composition

  // Build a stable key → color map from the full composition range (never the
  // snapshot), sorted the same way compositionDetail sorts, so colors don't
  // shift when switching between dates.
  const netWorthColorMap = (() => {
    const excludedKeys = new Set(['netIncome', 'startingBalance', 'endingBalance'])
    const groupOrder = breakdownData
      .filter((b) => !excludedKeys.has(b.key) && (!activeCompositionGroups || activeCompositionGroups.has(groupOf(b.key))))
      .map((b) => groupOf(b.key))
    const activeGroups = new Set(groupOrder)
    const sorted = [...composition]
      .filter((c) => activeGroups.has(c.group))
      .sort((a, b) => {
        const ga = groupOrder.indexOf(a.group)
        const gb = groupOrder.indexOf(b.group)
        if (ga !== gb) return ga - gb
        return b.value - a.value
      })
    const map = new Map<string, string>()
    sorted.forEach((c, i) => map.set(c.key, SLICE_COLORS[i % SLICE_COLORS.length]))
    return map
  })()

  // Full detail — every holding in the active group(s), largest first, labelled
  // and coloured. The donut draws only the top slice of this; the legend popover
  // lists all of it. Net worth items get a distinct palette (the long tail falls
  // back to the neutral colour); income/expense items keep the user's category colour.
  const compositionDetail = (() => {
    if (activeComposition.length === 0) return []

    const excludedKeys = new Set(['netIncome', 'startingBalance', 'endingBalance'])
    const activeGroups = new Set(
      compositionBreakdownData
        .filter((b) => !excludedKeys.has(b.key) && (!activeCompositionGroups || activeCompositionGroups.has(groupOf(b.key))))
        .map((b) => groupOf(b.key))
    )

    const itemLabel = (c: { label: string; key: string; group: string }) => {
      if (c.key === 'uncategorized') {
        // Uncategorized income and uncategorized expenses are distinct buckets
        // that share a label — qualify them by group so they don't look duplicated.
        const g = c.group === 'income' ? t('reports.income')
          : c.group === 'expenses' ? t('reports.expenses')
          : null
        return g ? `${t('reports.uncategorized')} · ${g}` : t('reports.uncategorized')
      }
      if (c.key === 'baseline') return t('reports.baseline')
      return c.label
    }

    const groupOrder = compositionBreakdownData
      .filter((b) => !excludedKeys.has(b.key) && (!activeCompositionGroups || activeCompositionGroups.has(groupOf(b.key))))
      .map((b) => groupOf(b.key))

    return activeComposition
      .filter((c) => activeGroups.has(c.group))
      .sort((a, b) => {
        const ga = groupOrder.indexOf(a.group)
        const gb = groupOrder.indexOf(b.group)
        if (ga !== gb) return ga - gb
        return b.value - a.value
      })
      .map((c) => ({
        name: itemLabel(c),
        value: c.value,
        color: activeTab === 'net_worth' ? (netWorthColorMap.get(c.key) ?? OTHER_SLICE_COLOR) : c.color,
        group: c.group,
        key: c.key,
      }))
  })()

  // Outer ring — items above 3 % of total get their own slice; everything else
  // per group folds into one "Other <Group>" slice. Outer arcs are anchored to
  // inner ring values so per-item rounding never misaligns the two rings.
  const outerDonutData = (() => {
    if (compositionDetail.length === 0) return []

    const excludedKeys = new Set(['netIncome', 'startingBalance', 'endingBalance'])
    const innerGroups = [
      ...new Set(
        compositionBreakdownData
          .filter((b) => !excludedKeys.has(b.key) && (!activeCompositionGroups || activeCompositionGroups.has(groupOf(b.key))))
          .map((b) => groupOf(b.key))
      ),
    ]

    const innerGroupValue = new Map<string, number>()
    for (const b of compositionBreakdownData) {
      if (!excludedKeys.has(b.key) && (!activeCompositionGroups || activeCompositionGroups.has(groupOf(b.key)))) {
        const g = groupOf(b.key)
        innerGroupValue.set(g, (innerGroupValue.get(g) ?? 0) + b.value)
      }
    }

    const totalValue = [...innerGroupValue.values()].reduce((s, v) => s + v, 0)

    const otherLabel = (g: string) =>
      g === 'accounts' ? t('reports.otherAccounts')
        : g === 'assets' ? t('reports.otherAssets')
          : g === 'liabilities' ? t('reports.otherLiabilities')
            : g === 'income' ? t('reports.otherIncome')
              : g === 'expenses' ? t('reports.otherExpenses')
                : t('reports.other')

    type DonutSlice = {
      name: string
      value: number
      color: string
      group: string
      key?: string
      /** Set on a collapsed category-group slice — clicking expands it. */
      groupId?: string
      /** Set on slices of an expanded group — clicking collapses it back. */
      memberOfGroupId?: string
      children?: { name: string; value: number; color: string }[]
    }

    const byGroup = new Map<string, DonutSlice[]>()
    for (const g of innerGroups) byGroup.set(g, [])
    for (const item of compositionDetail) byGroup.get(item.group)?.push(item)

    // Fold the category slices of one high-level bucket into category-group
    // slices; expanded groups contribute their member categories directly.
    // Pseudo-items (uncategorized/baseline/other) pass through untouched.
    const rollupCategorySlices = (items: DonutSlice[]): DonutSlice[] => {
      const byBucket = new Map<string, { bucket: GroupBucket; members: DonutSlice[] }>()
      const out: DonutSlice[] = []
      for (const item of items) {
        const bucket = item.key ? groupIndex.bucketByCategoryId.get(item.key) : undefined
        if (!bucket) {
          out.push(item)
          continue
        }
        let entry = byBucket.get(bucket.id)
        if (!entry) {
          entry = { bucket, members: [] }
          byBucket.set(bucket.id, entry)
        }
        entry.members.push(item)
      }
      for (const { bucket, members } of byBucket.values()) {
        if (expandedCatGroups.has(bucket.id)) {
          out.push(...members.map((m) => ({ ...m, memberOfGroupId: bucket.id })))
        } else {
          out.push({
            name: bucket.isUngrouped ? t('groups.noGroup') : bucket.name,
            value: members.reduce((s, m) => s + m.value, 0),
            color: bucket.color,
            group: members[0].group,
            key: `catgroup-${bucket.id}`,
            groupId: bucket.id,
            children: members,
          })
        }
      }
      return out.sort((a, b) => b.value - a.value)
    }

    const result: DonutSlice[] = []

    for (const g of innerGroups) {
      const all = isCategoryReport ? rollupCategorySlices(byGroup.get(g) ?? []) : (byGroup.get(g) ?? [])
      // Members of an explicitly expanded group always keep their own slice.
      const significant = all.filter((item) => item.memberOfGroupId || (totalValue > 0 && item.value / totalValue >= 0.03))
      const rest = all.filter((item) => !item.memberOfGroupId && (totalValue <= 0 || item.value / totalValue < 0.03))
      const topSum = significant.reduce((s, d) => s + d.value, 0)
      const innerTotal = innerGroupValue.get(g) ?? topSum
      const otherValue = Math.round((innerTotal - topSum) * 100) / 100
      for (const item of significant) result.push(item)
      if (otherValue > 0.005) {
        if (rest.length === 1) {
          result.push(rest[0])
        } else {
          result.push({
            name: otherLabel(g),
            value: otherValue,
            color: OTHER_SLICE_COLOR,
            group: g,
            children: rest.length > 0 ? rest : undefined,
          })
        }
      }
    }

    // The same category group can hold both income and expense categories, in
    // which case it appears once per bucket — qualify the label so the two
    // same-named, same-colored slices stay distinguishable.
    const groupSliceCount = new Map<string, number>()
    for (const s of result) {
      if (s.groupId) groupSliceCount.set(s.groupId, (groupSliceCount.get(s.groupId) ?? 0) + 1)
    }
    for (const s of result) {
      if (s.groupId && (groupSliceCount.get(s.groupId) ?? 0) > 1) {
        const qualifier = s.group === 'income' ? t('reports.income')
          : s.group === 'expenses' ? t('reports.expenses')
            : s.group === 'investments' ? t('reports.investments', { defaultValue: 'Investments' })
              : null
        if (qualifier) s.name = `${s.name} · ${qualifier}`
      }
    }

    return result
  })()

  // Category trend tiles rolled up by category group: one tile per group
  // (series summed element-wise); expanding a group swaps in its member
  // category tiles. Pseudo-items (uncategorized/other) stay standalone.
  type SparkTile = CategoryTrendItem & { groupId?: string; memberOfGroupId?: string; count?: number }
  const sparklineTiles: SparkTile[] = (() => {
    if (meta?.type !== 'income_expenses') return []
    const groupKey = sparklineView === 'byIncome' ? 'income' : 'expenses'
    const items = (data?.category_trend ?? []).filter((c) => c.group === groupKey)
    const byBucket = new Map<string, { bucket: GroupBucket; members: CategoryTrendItem[] }>()
    const out: SparkTile[] = []
    for (const item of items) {
      const bucket = groupIndex.bucketByCategoryId.get(item.key)
      if (!bucket) {
        out.push(item)
        continue
      }
      let entry = byBucket.get(bucket.id)
      if (!entry) {
        entry = { bucket, members: [] }
        byBucket.set(bucket.id, entry)
      }
      entry.members.push(item)
    }
    for (const { bucket, members } of byBucket.values()) {
      if (expandedCatGroups.has(bucket.id)) {
        out.push(...members.map((m) => ({ ...m, memberOfGroupId: bucket.id })))
      } else {
        out.push({
          key: `catgroup-${bucket.id}`,
          label: bucket.isUngrouped ? t('groups.noGroup') : bucket.name,
          color: bucket.color,
          total: members.reduce((s, m) => s + m.total, 0),
          group: groupKey,
          series: sumTrendSeries(members.map((m) => m.series)),
          groupId: bucket.id,
          count: members.length,
        })
      }
    }
    return out.sort((a, b) => b.total - a.total)
  })()

  return (
    <div>
      <PageHeader
        section={t('reports.section')}
        title={t(currentTab.labelKey)}
        action={
          <div className="flex items-center gap-2">
            {isCashFlow && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  cashFlowBaseline
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCashFlowBaseline((v) => !v)}
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                  aria-pressed={cashFlowBaseline}
                >
                  <span
                    className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
                      cashFlowBaseline ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                        cashFlowBaseline ? 'translate-x-3' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                  {t('reports.includeEstimate')}
                </button>
                <span
                  title={t('reports.includeEstimateHelp')}
                  aria-label={t('reports.includeEstimateHelp')}
                  className="inline-flex cursor-help"
                >
                  <HelpCircle className="h-3.5 w-3.5 opacity-60" />
                </span>
              </div>
            )}
            {isCashFlow ? (
              <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
                {FORWARD_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setRangeKey(opt.key); setSelectedDate(null) }}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                      rangeKey === opt.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                    }`}
                  >
                    {t(`reports.${RANGE_LABELS[opt.key]}`)}
                  </button>
                ))}
              </div>
            ) : (
              <DateRangeFilter
                value={dateFilter.value}
                onChange={handleDateFilterChange}
                modes={['month', 'rolling', 'ytd', 'custom']}
                className="text-xs"
              />
            )}
            <div className={`flex items-center rounded-lg border border-border bg-card overflow-hidden ${isMoneyMap ? 'hidden' : ''}`}>
              {intervalOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setInterval(opt.value); setSelectedDate(null) }}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    interval === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                  }`}
                >
                  {t(`reports.${INTERVAL_LABELS[opt.key]}`)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Tab Bar — one shared underline that slides between tabs. */}
      <div ref={tabBarRef} className="relative flex items-center gap-1 mb-5 border-b border-border">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            data-tab={tab.key}
            onClick={() => { if (tab.enabled) handleSelectTab(tab.key) }}
            disabled={!tab.enabled}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-foreground'
                : tab.enabled
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-muted-foreground/50 cursor-not-allowed'
            }`}
          >
            {t(tab.labelKey)}
            {!tab.enabled && (
              <span className="ml-1.5 text-[10px] text-muted-foreground/50">
                {t('reports.comingSoon')}
              </span>
            )}
          </button>
        ))}
        <span
          className="absolute bottom-0 h-0.5 bg-primary rounded-full transition-[left,width] duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>

      {/* Per-tab surface; switching to a cached tab renders instantly with no
          fade. Gated on !data (not isLoading): the query is briefly DISABLED
          while the tab's saved date filter loads, and disabled queries report
          isLoading=false — which flashed zero-value content before the
          skeleton. Wallet-only collections keep non-net-worth queries disabled
          forever, so that case must not skeleton indefinitely. */}
      <SkeletonSurface
        key={activeTab}
        className={slideDir === 'right' ? 'tab-enter-right' : 'tab-enter-left'}
        skeleton={<ReportsSkeleton />}
        loading={!data && !(noAccounts && activeTab !== 'net_worth')}
      >
      {/* Hero Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-5">
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="flex items-center gap-8">
              <Skeleton className="h-16 w-48" />
              <div className="flex gap-6">
                <Skeleton className="h-12 w-28" />
                <Skeleton className="h-12 w-28" />
                <Skeleton className="h-12 w-28" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5 uppercase tracking-wider">
                  {t(currentTab.labelKey)}
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-bold tabular-nums text-foreground">
                    {mask(formatCurrency(summary?.primary_value ?? 0, userCurrency, locale))}
                  </p>
                  {summary?.change_percent !== null && summary?.change_percent !== undefined && (
                    <span className={`text-sm font-semibold tabular-nums ${changeColor}`}>
                      {changePrefix}{summary.change_percent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mask(`${changePrefix}${formatCurrency(summary?.change_amount ?? 0, userCurrency, locale)}`)}
                  {' '}{t(meta?.type === 'cash_flow' ? 'reports.vsToday' : 'reports.vsStart')}
                </p>
              </div>
              <div className="flex flex-wrap gap-6">
                {breakdownData.map((b) => (
                  <div key={b.key} className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: b.color }}
                      />
                      <p className="text-xs font-medium text-muted-foreground">
                        {t(`reports.${b.key}`, { defaultValue: b.label })}
                      </p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {mask(formatCurrency(b.value, userCurrency, locale))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flow (Sankey) */}
      {isMoneyMap && (
        <div className="bg-card rounded-xl border border-border shadow-sm mb-5">
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {t('reports.moneyMap')}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }} />
                <span className="text-[11px] text-muted-foreground">{t('reports.income')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F43F5E' }} />
                <span className="text-[11px] text-muted-foreground">{t('reports.expenses')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0EA5E9' }} />
                <span className="text-[11px] text-muted-foreground">{t('reports.investments')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                <span className="text-[11px] text-muted-foreground">{t('reports.deficit')}</span>
              </div>
            </div>
          </div>
          <div className="px-3 pb-5">
            {isLoading ? (
              <div className="px-2"><Skeleton className="h-[360px] w-full" /></div>
            ) : (
              <CashflowSankey
                composition={composition}
                currency={userCurrency}
                locale={locale}
                groupIndex={groupIndex}
                expandedGroups={expandedCatGroups}
                onToggleGroup={toggleCatGroup}
              />
            )}
          </div>
        </div>
      )}

      {!isMoneyMap && (
      <>
      {/* Main Trend Chart */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-5">
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {t(currentTab.labelKey)} · {t('reports.trend')}
          </p>
          {meta && (
            <div className="flex items-center gap-3">
              {meta.type === 'net_worth' ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6366F1' }} />
                  <span className="text-[11px] text-muted-foreground">
                    {t('reports.netWorth')}
                  </span>
                </div>
              ) : (
                meta.series_keys.map((key) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: colorMap[key] || '#6366F1' }}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {t(`reports.${key}`, { defaultValue: key })}
                    </span>
                  </div>
                ))
              )}
              {meta.type === 'income_expenses' && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: '#6366F1' }} />
                  <span className="text-[11px] text-muted-foreground">
                    {t('reports.netIncome')}
                  </span>
                </div>
              )}
              {meta.type === 'cash_flow' && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: '#6366F1' }} />
                  <span className="text-[11px] text-muted-foreground">
                    {meta.baseline_active ? t('reports.forecastBaseline') : t('reports.forecast')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-1 pb-4" style={{ height: 320 }}>
          {isLoading ? (
            <div className="px-4">
              <Skeleton className="h-full w-full" />
            </div>
          ) : chartData.length > 0 ? (
            meta?.type === 'cash_flow' ? (() => {
              const startingBalance = summary?.breakdowns.find((b) => b.key === 'startingBalance')?.value ?? 0
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v) => {
                        if (privacyMode) return ''
                        if (v === 0) return '0'
                        return formatCompact(v, userCurrency, locale)
                      }}
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                      tickCount={5}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null
                        const point = payload[0].payload as Record<string, number>
                        const balance = point.value ?? 0
                        const inflow = point.inflow ?? 0
                        const outflow = point.outflow ?? 0
                        return (
                          <div style={tooltipStyle} className="px-3 py-2">
                            <p className="text-xs font-medium mb-1">{label}</p>
                            <p className="text-xs" style={{ color: '#6366F1' }}>
                              {t('reports.balance', { defaultValue: 'Balance' })}:{' '}
                              {privacyMode ? MASK : formatCurrency(balance, userCurrency, locale)}
                            </p>
                            {inflow > 0 && (
                              <p className="text-xs" style={{ color: '#10B981' }}>
                                {t('reports.inflow')}:{' '}
                                {privacyMode ? MASK : `+${formatCurrency(inflow, userCurrency, locale)}`}
                              </p>
                            )}
                            {outflow > 0 && (
                              <p className="text-xs" style={{ color: '#F43F5E' }}>
                                {t('reports.outflow')}:{' '}
                                {privacyMode ? MASK : `-${formatCurrency(outflow, userCurrency, locale)}`}
                              </p>
                            )}
                          </div>
                        )
                      }}
                    />
                    <ReferenceLine
                      y={startingBalance}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                    {forecastStart && (
                      <ReferenceLine
                        x={forecastStart}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                        label={{
                          value: t('reports.today'),
                          position: 'insideTopRight',
                          fill: 'var(--muted-foreground)',
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="valuePast"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      fill="url(#cashFlowGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366F1' }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="valueForecast"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      fill="url(#cashFlowGrad)"
                      fillOpacity={0.4}
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366F1' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            })() : meta?.type === 'income_expenses' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => {
                    if (privacyMode) return ''
                    if (v === 0) return '0'
                    return formatCompact(v, userCurrency, locale)
                  }}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickCount={5}
                />
                <Tooltip
                  formatter={(value?: number, name?: string) => [
                    privacyMode ? MASK : formatCurrency(value ?? 0, userCurrency, locale),
                    name === 'value'
                      ? t('reports.netIncome')
                      : t(`reports.${name ?? ''}`, { defaultValue: name ?? '' }),
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={tooltipStyle}
                />
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366F1"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366F1' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => {
                    if (privacyMode) return ''
                    if (v === 0) return '0'
                    return formatCompact(v, userCurrency, locale)
                  }}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickCount={5}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const point = payload[0]?.payload as Record<string, number | null>
                    const value = (payload[0]?.value as number) ?? 0
                    const change = point.change ?? null
                    const changeSign = change !== null && change >= 0 ? '+' : ''
                    const changeColor = change !== null ? (change >= 0 ? '#10B981' : '#F43F5E') : ''
                    return (
                      <div style={tooltipStyle} className="px-3 py-2">
                        <p className="text-xs font-medium mb-1">{label}</p>
                        <p className="text-xs" style={{ color: '#6366F1' }}>
                          {t(currentTab.labelKey)}:{' '}
                          {privacyMode ? MASK : formatCurrency(value, userCurrency, locale)}
                        </p>
                        {change !== null && (
                          <p className="text-xs" style={{ color: changeColor }}>
                            {t('reports.change')}:{' '}
                            {privacyMode ? MASK : `${changeSign}${formatCurrency(change, userCurrency, locale)}`}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  fill="url(#netWorthGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366F1' }}
                />
              </AreaChart>
            </ResponsiveContainer>
            )
          ) : (
            <p className="text-muted-foreground text-sm text-center py-16">
              {t('reports.noData')}
            </p>
          )}
        </div>
      </div>

      {/* Breakdown: Donut + Grouped Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Composition widget — summary ring + ranked, labelled detail bars */}
        <div className={`rounded-xl border shadow-sm transition-colors ${selectedDate ? 'bg-primary/5 border-primary/50' : 'bg-card border-border'}`}>
          <div className="px-5 pt-4 pb-2 flex flex-col gap-2 min-[635px]:flex-row min-[635px]:items-start min-[635px]:justify-between lg:flex-col lg:items-start xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-foreground">{t('reports.composition')}</p>
              {selectedDate && (
                <span className="text-xs text-primary font-medium">{t('reports.asOf', { date: selectedDate })}</span>
              )}
            </div>
            <div className="flex items-stretch rounded-lg border border-border bg-muted/30 overflow-hidden w-fit">
              {compositionOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCompositionView(opt)}
                  className={`px-2 py-1 text-[11px] font-semibold text-center transition-colors ${
                    compositionView === opt
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                  }`}
                >
                  {t(`reports.${opt}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="px-1 pb-4">
            {isLoading ? (
              <div className="flex flex-col items-center px-4 py-2">
                <div className="relative" style={{ width: 200, height: 200 }}>
                  <Skeleton className="w-full h-full rounded-full" />
                  <div
                    className="absolute flex flex-col items-center justify-center gap-1 rounded-full bg-card"
                    style={{ width: 110, height: 110, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    <Skeleton className="h-2 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3">
                  {Array.from({ length: activeTab === 'net_worth' ? 3 : 2 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                      <Skeleton className="h-2 w-14" />
                    </div>
                  ))}
                </div>
              </div>
            ) : innerDonutData.length > 0 ? (
                (() => {
                  const hasOuter = outerDonutData.length > 0
                  const donutTotal = innerDonutData.reduce((s, d) => s + d.value, 0)
                  return (
                    <div className="flex flex-col items-center">
                      <div className="relative" style={{ width: 200, height: 200 }}>
                        <PieChart width={200} height={200}>
                            <Pie
                              data={innerDonutData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={hasOuter ? 63 : 85}
                              paddingAngle={hasOuter ? 0 : 3}
                              dataKey="value"
                              stroke="var(--card)"
                              strokeWidth={hasOuter ? 2 : 0}
                              animationDuration={350}
                              animationEasing="ease-out"
                            >
                              {innerDonutData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            {hasOuter && (
                              <Pie
                                data={outerDonutData}
                                cx="50%"
                                cy="50%"
                                innerRadius={64}
                                outerRadius={90}
                                paddingAngle={0}
                                dataKey="value"
                                stroke="var(--card)"
                                strokeWidth={2}
                                animationDuration={350}
                                animationEasing="ease-out"
                              >
                                {outerDonutData.map((entry, idx) => {
                                  const toggleId = entry.groupId ?? entry.memberOfGroupId
                                  return (
                                    <Cell
                                      key={idx}
                                      fill={entry.color}
                                      cursor={toggleId ? 'pointer' : undefined}
                                      onClick={toggleId ? () => toggleCatGroup(toggleId) : undefined}
                                    />
                                  )
                                })}
                              </Pie>
                            )}
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const entry = payload[0]
                                const v = (entry.value as number) ?? 0
                                const pct = donutTotal > 0 ? ((v / donutTotal) * 100).toFixed(1) : '0'
                                const rawName = (entry.name as string) ?? ''
                                const displayName = rawName.length > 50 ? rawName.slice(0, 47) + '…' : rawName
                                const children = (entry.payload as { children?: { name: string; value: number; color: string }[] }).children
                                return (
                                  <div style={{ ...tooltipStyle, padding: '8px 12px', zIndex: 10, maxWidth: 256 }}>
                                    <p className="text-xs font-semibold mb-1">{displayName}</p>
                                    <p className="text-xs">
                                      {privacyMode ? MASK : `${formatCurrency(v, userCurrency, locale)} (${pct}%)`}
                                    </p>
                                    {children && children.length > 0 && (
                                      <div className="mt-1.5 border-t border-border/50 pt-1.5 flex flex-col gap-0.5" style={{ maxHeight: 180, overflowY: 'auto', paddingRight: '0.5rem' }}>
                                        {children.map((child, i) => {
                                          const childPct = donutTotal > 0 ? ((child.value / donutTotal) * 100).toFixed(1) : '0'
                                          return (
                                            <div key={i} className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: child.color }} />
                                                <span className="text-xs text-muted-foreground truncate">
                                                  {child.name.length > 25 ? child.name.slice(0, 22) + '…' : child.name}
                                                </span>
                                              </div>
                                              <span className="text-xs text-muted-foreground shrink-0">
                                                {privacyMode ? MASK : `${formatCurrency(child.value, userCurrency, locale)} (${childPct}%)`}
                                              </span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              }}
                              wrapperStyle={{ zIndex: 10, pointerEvents: 'auto' }}
                              offset={20}
                            />
                        </PieChart>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
                          <span className="text-[10px] text-muted-foreground">
                            {compositionView === 'assetsAndAccounts'
                              ? t(isHistoricalSnapshot ? 'reports.youOwned' : 'reports.youOwn', { defaultValue: isHistoricalSnapshot ? 'You Owned' : 'You Own' })
                              : compositionView === 'liabilities'
                                ? t(isHistoricalSnapshot ? 'reports.youOwed' : 'reports.youOwe', { defaultValue: isHistoricalSnapshot ? 'You Owed' : 'You Owe' })
                                : compositionView === 'byIncome' ? t('reports.income')
                                : compositionView === 'byExpenses' ? t('reports.expenses')
                                : meta?.type === 'income_expenses' ? t('reports.netIncome')
                                : t(currentTab.labelKey)}
                          </span>
                          <span className="text-base font-bold text-foreground tabular-nums">
                            {mask(formatCompact(
                              snapshotTrendPoint
                                ? compositionView === 'netWorth' || compositionView === 'net' || !compositionView
                                  ? snapshotTrendPoint.value
                                  : innerDonutData.reduce((s, d) => s + d.value, 0)
                                : compositionView === 'netWorth' || compositionView === 'net' || !compositionView
                                  ? meta?.type === 'cash_flow'
                                    ? (summary?.change_amount ?? 0)
                                    : (summary?.primary_value ?? 0)
                                  : innerDonutData.reduce((s, d) => s + d.value, 0),
                              userCurrency, locale
                            ))}
                          </span>
                        </div>
                      </div>
                      <div key={compositionView} className="flex flex-col items-center gap-1 px-3 mt-1 w-full">
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                          {innerDonutData.map((d, i) => (
                            <div key={`${i}-${d.name}`} className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {d.name.length > 30 ? d.name.slice(0, 27) + '…' : d.name}
                              </span>
                            </div>
                          ))}
                        </div>
                        {hasOuter && (() => {
                          const visible = outerDonutData.slice(0, 6)
                          const hiddenCount = compositionDetail.length - visible.length
                          return (
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 items-center">
                              {visible.map((d, i) => {
                                const toggleId = d.groupId ?? d.memberOfGroupId
                                const label = (
                                  <>
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                      {d.name.length > 30 ? d.name.slice(0, 27) + '…' : d.name}
                                    </span>
                                  </>
                                )
                                return toggleId ? (
                                  <button
                                    key={`${i}-${d.name}`}
                                    type="button"
                                    onClick={() => toggleCatGroup(toggleId)}
                                    className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                                    aria-expanded={!!d.memberOfGroupId}
                                  >
                                    {label}
                                    {d.groupId
                                      ? <ChevronRight size={10} className="text-muted-foreground shrink-0" />
                                      : <ChevronDown size={10} className="text-muted-foreground shrink-0" />}
                                  </button>
                                ) : (
                                  <div key={`${i}-${d.name}`} className="flex items-center gap-1.5">
                                    {label}
                                  </div>
                                )
                              })}
                              {hiddenCount > 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                    >
                                      +{hiddenCount} more
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="center" side="top" sideOffset={8} className="w-64 p-3">
                                    <p className="text-xs font-semibold text-foreground mb-2">
                                      {t('reports.composition')}
                                    </p>
                                    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-2">
                                      {compositionDetail.map((d, i) => {
                                        const pct = donutTotal > 0 ? ((d.value / donutTotal) * 100).toFixed(1) : '0'
                                        return (
                                          <div key={`${i}-${d.name}`} className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                            <span className="text-[11px] text-muted-foreground flex-1 truncate">
                                              {d.name.length > 25 ? d.name.slice(0, 22) + '…' : d.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                              {privacyMode ? MASK : `${formatCurrency(d.value, userCurrency, locale)} (${pct}%)`}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()
              ) : (
                <p className="text-muted-foreground text-sm text-center py-16">{t('reports.noData')}</p>
              )
            }
          </div>
        </div>

        {/* Evolution / Category Sparklines */}
        <div className={`lg:col-span-2 rounded-xl border shadow-sm transition-colors ${selectedDate && meta?.type !== 'income_expenses' ? 'bg-primary/5 border-primary/50' : 'bg-card border-border'}`}>
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {meta?.type === 'income_expenses'
                  ? t('reports.categoryTrends')
                  : meta?.type === 'cash_flow'
                    ? t('reports.inflowOutflow')
                    : t('reports.evolution')}
              </p>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 whitespace-nowrap"
                >
                  {selectedDate}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {meta?.type === 'income_expenses' && (() => {
              const totalPages = Math.ceil(sparklineTiles.length / 6)
              const hasPagination = totalPages > 1
              return (
                <div className="flex items-center gap-2">
                  {hasPagination && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setSparklinePage((p) => Math.max(0, p - 1))}
                        disabled={sparklinePage === 0}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                      <button
                        onClick={() => setSparklinePage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={sparklinePage >= totalPages - 1}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    </div>
                  )}
                  <div className="flex items-center rounded-lg border border-border bg-muted/30 overflow-hidden">
                    {(['byExpenses', 'byIncome'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setSparklineView(opt); setSparklinePage(0) }}
                        className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          sparklineView === opt
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                        }`}
                      >
                        {t(`reports.${opt}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
          {meta?.type === 'income_expenses' ? (
            <div className="pb-4 overflow-hidden">
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (() => {
                if (sparklineTiles.length === 0) {
                  return (
                    <p className="text-muted-foreground text-sm text-center py-16">
                      {t('reports.noData')}
                    </p>
                  )
                }
                const totalPages = Math.ceil(sparklineTiles.length / 6)
                const effectivePage = Math.min(sparklinePage, totalPages - 1)
                const pages = Array.from({ length: totalPages }, (_, i) =>
                  sparklineTiles.slice(i * 6, i * 6 + 6)
                )
                return (
                  <div
                    className="flex"
                    style={{
                      transform: `translateX(-${effectivePage * 100}%)`,
                      transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {pages.map((pageItems, pageIdx) => (
                      <div
                        key={pageIdx}
                        className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full shrink-0 px-4"
                      >
                        {pageItems.map((item) => {
                          const sparkData = item.series.map((s) => ({ date: s.date, v: s.value }))
                          const gradId = `grad-${item.key}-${item.group}-p${pageIdx}`
                          const toggleId = item.groupId ?? item.memberOfGroupId
                          return (
                            <div
                              key={`${item.key}-${item.group}`}
                              className={`rounded-lg border border-border/50 bg-muted/20 px-3 py-2 ${toggleId ? 'cursor-pointer hover:border-border transition-colors' : ''}`}
                              onClick={toggleId ? () => toggleCatGroup(toggleId) : undefined}
                              aria-expanded={item.memberOfGroupId ? true : item.groupId ? false : undefined}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {item.key === 'uncategorized' ? t('reports.uncategorized') : item.key === 'other' ? t('reports.other') : item.label}
                                </span>
                                {item.count != null && (
                                  <span className="text-[10px] text-muted-foreground/70 shrink-0">({item.count})</span>
                                )}
                                {item.groupId && <ChevronRight size={10} className="text-muted-foreground shrink-0 ml-auto" />}
                                {item.memberOfGroupId && <ChevronDown size={10} className="text-muted-foreground shrink-0 ml-auto" />}
                              </div>
                              <p className="text-xs font-bold tabular-nums text-foreground mb-1">
                                {mask(formatCompact(item.total, userCurrency, locale))}
                              </p>
                              <div style={{ height: 48 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={item.color} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={item.color} stopOpacity={0.02} />
                                      </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <Tooltip
                                      formatter={(value?: number) => [
                                        privacyMode ? MASK : formatCurrency(value ?? 0, userCurrency, locale),
                                        item.label,
                                      ]}
                                      labelFormatter={(label) => label}
                                      contentStyle={{ ...tooltipStyle, padding: '4px 8px' }}
                                    />
                                    <Area
                                      type="monotone"
                                      dataKey="v"
                                      stroke={item.color}
                                      strokeWidth={1.5}
                                      fill={`url(#${gradId})`}
                                      dot={false}
                                      activeDot={{ r: 2, fill: item.color }}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          ) : (
          <div className="px-1 pb-4" style={{ height: 280 }}>
            {isLoading ? (
              <div className="px-4">
                <Skeleton className="h-full w-full" />
              </div>
            ) : chartData.length > 0 && meta ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  stackOffset="sign"
                  onClick={(payload) => {
                    const date = payload?.activeLabel as string | undefined
                    if (!date) return
                    setSelectedDate((prev) => (prev === date ? null : date))
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => {
                      if (privacyMode) return ''
                      if (v === 0) return '0'
                      return formatCompact(v, userCurrency, locale)
                    }}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickCount={5}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null
                      const items = payload.filter((p) => p.value !== null && p.value !== undefined && (p.value as number) !== 0)
                      if (items.length === 0) return null
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="text-xs font-medium mb-1">{label}</p>
                          {items.map((p) => (
                            <p key={p.dataKey as string} className="text-xs" style={{ color: p.color }}>
                              {t(`reports.${p.dataKey}`, { defaultValue: p.name })}:{' '}
                              {privacyMode ? MASK : formatCurrency(p.value as number, userCurrency, locale)}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    formatter={(value: string) => t(`reports.${value}`, { defaultValue: value })}
                  />
                  {(() => {
                    const isNetWorth = meta.type === 'net_worth'
                    const allSeries = meta.type === 'cash_flow'
                      ? [
                          { key: 'inflow', color: '#10B981' },
                          { key: 'outflow', color: '#F43F5E' },
                        ]
                      : meta.series_keys.map((k) => ({ key: k, color: colorMap[k] || '#6366F1' }))
                    const filteredSeries = allSeries.filter(({ key }) =>
                      chartData.some((d) => { const v = d[key]; return typeof v === 'number' && v !== 0 })
                    )
                    const positiveKeys = isNetWorth ? filteredSeries.filter(({ key }) => !NEGATIVE_SERIES.has(key)) : filteredSeries
                    const negativeKeys = isNetWorth ? filteredSeries.filter(({ key }) => NEGATIVE_SERIES.has(key)) : []
                    const lastPositiveKey = positiveKeys.at(-1)?.key ?? null
                    const lastNegativeKey = negativeKeys.at(-1)?.key ?? null
                    return filteredSeries.map(({ key, color }) => {
                      let radius: [number, number, number, number] = [0, 0, 0, 0]
                      if (isNetWorth && NEGATIVE_SERIES.has(key) && key === lastNegativeKey) {
                        radius = [4, 4, 0, 0]
                      } else if (key === lastPositiveKey) {
                        radius = [4, 4, 0, 0]
                      }
                      return (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="stack"
                          fill={color}
                          radius={radius}
                          maxBarSize={32}
                        >
                          {selectedDate && chartData.map((d) => (
                            <Cell
                              key={d.date}
                              fill={color}
                              fillOpacity={d.date === selectedDate ? 1 : 0.4}
                            />
                          ))}
                        </Bar>
                      )
                    })
                  })()}
                  {meta.type === 'net_worth' && (
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={t('reports.netWorth', { defaultValue: 'Net Worth' })}
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={{ r: 4, fill: '#10B981' }}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-16">
                {t('reports.noData')}
              </p>
            )}
          </div>
          )}
        </div>
      </div>
      </>
      )}
      </SkeletonSurface>
    </div>
  )
}
