import { useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addYears,
  subYears,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  setMonth as dfSetMonth,
  setYear as dfSetYear,
  type Locale,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateRangeSelection {
  from?: Date
  to?: Date
}

interface CalendarProps {
  mode?: 'single' | 'range'
  selected?: Date
  /** Range mode: current selection; first click sets from, second sets to. */
  selectedRange?: DateRangeSelection
  defaultMonth?: Date
  locale?: Locale
  onSelect?: (date: Date | undefined) => void
  onSelectRange?: (range: DateRangeSelection) => void
  className?: string
}

type View = 'days' | 'months' | 'years'
const YEAR_PAGE_SIZE = 12

function Calendar({
  mode = 'single',
  selected,
  selectedRange,
  defaultMonth,
  locale,
  onSelect,
  onSelectRange,
  className,
}: CalendarProps) {
  const [viewMonth, setViewMonth] = useState(
    defaultMonth ?? (mode === 'range' ? selectedRange?.from : selected) ?? new Date(),
  )
  const [view, setView] = useState<View>('days')
  // Range mode: day under the cursor, for previewing from→hover before the
  // second click lands.
  const [hoverDay, setHoverDay] = useState<Date | null>(null)

  const handleDayClick = (d: Date) => {
    if (mode !== 'range') {
      onSelect?.(d)
      return
    }
    const { from, to } = selectedRange ?? {}
    if (!from || to) {
      onSelectRange?.({ from: d, to: undefined })
    } else if (d < from) {
      onSelectRange?.({ from: d, to: from })
    } else {
      onSelectRange?.({ from, to: d })
    }
  }

  const currentYear = viewMonth.getFullYear()
  const yearPageStart = Math.floor(currentYear / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE

  const goPrev = () => {
    if (view === 'days') setViewMonth(subMonths(viewMonth, 1))
    else if (view === 'months') setViewMonth(subYears(viewMonth, 1))
    else setViewMonth(subYears(viewMonth, YEAR_PAGE_SIZE))
  }
  const goNext = () => {
    if (view === 'days') setViewMonth(addMonths(viewMonth, 1))
    else if (view === 'months') setViewMonth(addYears(viewMonth, 1))
    else setViewMonth(addYears(viewMonth, YEAR_PAGE_SIZE))
  }

  const headerLabel =
    view === 'days'
      ? format(viewMonth, 'LLLL yyyy', { locale })
      : view === 'months'
        ? format(viewMonth, 'yyyy', { locale })
        : `${yearPageStart} – ${yearPageStart + YEAR_PAGE_SIZE - 1}`

  const onHeaderClick = () => {
    if (view === 'days') setView('months')
    else if (view === 'months') setView('years')
  }

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { locale })
  const calEnd = endOfWeek(monthEnd, { locale })

  const weeks: Date[][] = []
  let day = calStart
  while (day <= calEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }

  const weekdayLabels: string[] = []
  for (let i = 0; i < 7; i++) {
    weekdayLabels.push(format(addDays(calStart, i), 'EEEEEE', { locale }))
  }

  return (
    <div className={cn('p-3 w-[252px]', className)}>
      {/* Header: nav + caption */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goPrev}
          className="size-7 inline-flex items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={onHeaderClick}
          disabled={view === 'years'}
          className={cn(
            'text-sm font-medium text-foreground capitalize px-2 py-1 rounded-md transition-colors',
            view !== 'years' && 'hover:bg-muted/60 cursor-pointer',
            view === 'years' && 'cursor-default',
          )}
        >
          {headerLabel}
        </button>
        <button
          type="button"
          onClick={goNext}
          className="size-7 inline-flex items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      {view === 'days' && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {weekdayLabels.map((label, i) => (
              <div key={i} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" onMouseLeave={() => setHoverDay(null)}>
            {weeks.map((week, wi) =>
              week.map((d, di) => {
                const inMonth = isSameMonth(d, viewMonth)
                const today = isToday(d)

                if (mode === 'range') {
                  const { from, to } = selectedRange ?? {}
                  // With only the start picked, preview the span to the cursor.
                  const previewEnd = to ?? (from && hoverDay && hoverDay > from ? hoverDay : undefined)
                  const isStart = from && isSameDay(d, from)
                  const isEnd = (to && isSameDay(d, to)) || (!to && isStart)
                  const inRange = from && previewEnd && d > from && d < previewEnd
                  return (
                    <button
                      key={`${wi}-${di}`}
                      type="button"
                      onClick={() => handleDayClick(d)}
                      onMouseEnter={() => setHoverDay(d)}
                      className={cn(
                        'size-8 inline-flex items-center justify-center text-sm transition-colors',
                        isStart || isEnd ? 'rounded-lg' : inRange ? 'rounded-none' : 'rounded-lg',
                        isStart && !to && 'rounded-lg',
                        isStart && to && !isSameDay(from!, to) && 'rounded-r-none',
                        isEnd && to && from && !isSameDay(from, to) && 'rounded-l-none',
                        !inMonth && !inRange && !isStart && !isEnd && 'text-muted-foreground/40',
                        inMonth && !isStart && !isEnd && !inRange && 'text-foreground hover:bg-muted/60',
                        today && !isStart && !isEnd && !inRange && 'bg-accent text-accent-foreground font-medium',
                        inRange && 'bg-primary/15 text-foreground',
                        (isStart || isEnd) && 'bg-primary text-primary-foreground font-semibold',
                      )}
                    >
                      {d.getDate()}
                    </button>
                  )
                }

                const isSelected = selected && isSameDay(d, selected)
                return (
                  <button
                    key={`${wi}-${di}`}
                    type="button"
                    onClick={() => handleDayClick(d)}
                    className={cn(
                      'size-8 inline-flex items-center justify-center rounded-lg text-sm transition-colors',
                      !inMonth && 'text-muted-foreground/40',
                      inMonth && !isSelected && 'text-foreground hover:bg-muted/60',
                      today && !isSelected && 'bg-accent text-accent-foreground font-medium',
                      isSelected && 'bg-primary text-primary-foreground font-semibold',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              }),
            )}
          </div>
        </>
      )}

      {view === 'months' && (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 12 }).map((_, i) => {
            const monthDate = dfSetMonth(viewMonth, i)
            const isCurrent =
              selected &&
              selected.getFullYear() === monthDate.getFullYear() &&
              selected.getMonth() === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setViewMonth(monthDate)
                  setView('days')
                }}
                className={cn(
                  'h-10 rounded-lg text-sm capitalize transition-colors',
                  isCurrent
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-foreground hover:bg-muted/60',
                )}
              >
                {format(monthDate, 'MMM', { locale })}
              </button>
            )
          })}
        </div>
      )}

      {view === 'years' && (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: YEAR_PAGE_SIZE }).map((_, i) => {
            const y = yearPageStart + i
            const isCurrent = selected && selected.getFullYear() === y
            return (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setViewMonth(dfSetYear(viewMonth, y))
                  setView('months')
                }}
                className={cn(
                  'h-10 rounded-lg text-sm transition-colors',
                  isCurrent
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-foreground hover:bg-muted/60',
                )}
              >
                {y}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { Calendar }
export type { CalendarProps, DateRangeSelection }
