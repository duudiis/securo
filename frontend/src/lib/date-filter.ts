import { addDays, format, startOfYear, subDays, subMonths, subYears } from 'date-fns'
import { monthLabel, monthRange } from '@/lib/month-utils'
import type { TFunction } from 'i18next'

/**
 * The global date-filter value: a whole calendar month, a rolling window
 * ending today (past N days/months/years or year-to-date), or an explicit
 * custom range. Persisted per page via the page-settings API — rolling modes
 * are stored symbolically so "past 30 days" still means the LAST 30 days when
 * restored next week.
 */
export type DateFilterValue =
  | { mode: 'month'; month: string } // 'YYYY-MM'
  | { mode: 'rolling'; unit: 'days' | 'months' | 'years'; count: number }
  | { mode: 'ytd' }
  | { mode: 'custom'; from: string; to: string } // 'YYYY-MM-DD', both inclusive

export type DateFilterMode = DateFilterValue['mode']

export interface DateRange {
  from: string
  to: string
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/** Resolve a filter value to inclusive from/to date strings. */
export function resolveDateRange(value: DateFilterValue, today: Date = new Date()): DateRange {
  switch (value.mode) {
    case 'month':
      return monthRange(value.month)
    case 'rolling': {
      const to = fmt(today)
      if (value.unit === 'days') return { from: fmt(subDays(today, value.count - 1)), to }
      if (value.unit === 'months') return { from: fmt(addDays(subMonths(today, value.count), 1)), to }
      return { from: fmt(addDays(subYears(today, value.count), 1)), to }
    }
    case 'ytd':
      return { from: fmt(startOfYear(today)), to: fmt(today) }
    case 'custom':
      return { from: value.from, to: value.to }
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

/** Safely parse a persisted (untrusted JSON) value; null when invalid. */
export function parseDateFilterValue(raw: unknown): DateFilterValue | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  switch (v.mode) {
    case 'month':
      return typeof v.month === 'string' && ISO_MONTH.test(v.month)
        ? { mode: 'month', month: v.month }
        : null
    case 'rolling': {
      const unit = v.unit
      const count = v.count
      return (unit === 'days' || unit === 'months' || unit === 'years') &&
        typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 3650
        ? { mode: 'rolling', unit, count }
        : null
    }
    case 'ytd':
      return { mode: 'ytd' }
    case 'custom':
      return typeof v.from === 'string' && ISO_DATE.test(v.from) &&
        typeof v.to === 'string' && ISO_DATE.test(v.to)
        ? { mode: 'custom', from: v.from, to: v.to }
        : null
    default:
      return null
  }
}

/** Human label for the trigger button / chips. */
export function formatDateFilterValue(
  value: DateFilterValue,
  t: TFunction,
  dateLocale: string,
): string {
  const fmtDay = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
  switch (value.mode) {
    case 'month':
      return monthLabel(value.month, dateLocale)
    case 'rolling':
      return value.unit === 'days'
        ? t('dateFilter.pastDays', { count: value.count })
        : value.unit === 'months'
          ? t('dateFilter.pastMonths', { count: value.count })
          : t('dateFilter.pastYears', { count: value.count })
    case 'ytd':
      return t('dateFilter.ytd')
    case 'custom':
      return `${fmtDay(value.from)} — ${fmtDay(value.to)}`
  }
}

/** Two values select the same window? (Used to avoid redundant saves.) */
export function dateFilterEquals(a: DateFilterValue | null, b: DateFilterValue | null): boolean {
  if (!a || !b) return a === b
  return JSON.stringify(a) === JSON.stringify(b)
}
