import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MonthPicker } from '@/components/ui/monthpicker'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { useDateLocale } from '@/hooks/use-display-locale'
import { resolveDateFnsLocale } from '@/lib/date-fns-locale'
import { currentMonth } from '@/lib/month-utils'
import { cn } from '@/lib/utils'
import {
  formatDateFilterValue,
  type DateFilterMode,
  type DateFilterValue,
} from '@/lib/date-filter'

type TabKey = 'month' | 'rolling' | 'custom'

const ROLLING_PRESETS: Array<{ key: string; value: DateFilterValue }> = [
  { key: '7d', value: { mode: 'rolling', unit: 'days', count: 7 } },
  { key: '30d', value: { mode: 'rolling', unit: 'days', count: 30 } },
  { key: '90d', value: { mode: 'rolling', unit: 'days', count: 90 } },
  { key: '3m', value: { mode: 'rolling', unit: 'months', count: 3 } },
  { key: '6m', value: { mode: 'rolling', unit: 'months', count: 6 } },
  { key: 'ytd', value: { mode: 'ytd' } },
  { key: '1y', value: { mode: 'rolling', unit: 'years', count: 1 } },
  { key: '2y', value: { mode: 'rolling', unit: 'years', count: 2 } },
]

interface DateRangeFilterProps {
  value: DateFilterValue
  onChange: (value: DateFilterValue) => void
  /** Which modes this page supports; 'ytd' rides the rolling tab. */
  modes?: DateFilterMode[]
  align?: 'start' | 'center' | 'end'
  className?: string
}

/**
 * The global date filter: one control for whole-month, rolling-window
 * (past N days/months/years, YTD) and custom from–to picks, so every page
 * offers the same date semantics.
 */
export function DateRangeFilter({
  value,
  onChange,
  modes = ['month', 'rolling', 'ytd', 'custom'],
  align = 'end',
  className,
}: DateRangeFilterProps) {
  const { t, i18n } = useTranslation()
  const dateLocale = useDateLocale()
  const dateFnsLocale = resolveDateFnsLocale(i18n.resolvedLanguage ?? i18n.language)

  const tabs = useMemo(() => {
    const out: TabKey[] = []
    if (modes.includes('month')) out.push('month')
    if (modes.includes('rolling') || modes.includes('ytd')) out.push('rolling')
    if (modes.includes('custom')) out.push('custom')
    return out
  }, [modes])

  const tabOfValue: TabKey = value.mode === 'month' ? 'month' : value.mode === 'custom' ? 'custom' : 'rolling'

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>(tabOfValue)
  const [draftFrom, setDraftFrom] = useState<Date | undefined>(undefined)
  const [draftTo, setDraftTo] = useState<Date | undefined>(undefined)
  const [rollingCount, setRollingCount] = useState('30')
  const [rollingUnit, setRollingUnit] = useState<'days' | 'months' | 'years'>('days')

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setActiveTab(tabs.includes(tabOfValue) ? tabOfValue : tabs[0])
      if (value.mode === 'custom') {
        setDraftFrom(new Date(value.from + 'T00:00:00'))
        setDraftTo(new Date(value.to + 'T00:00:00'))
      } else {
        setDraftFrom(undefined)
        setDraftTo(undefined)
      }
      if (value.mode === 'rolling') {
        setRollingCount(String(value.count))
        setRollingUnit(value.unit)
      }
    }
  }

  const pick = (next: DateFilterValue) => {
    onChange(next)
    setOpen(false)
  }

  const applyCustom = () => {
    if (!draftFrom || !draftTo) return
    const [from, to] = draftFrom <= draftTo ? [draftFrom, draftTo] : [draftTo, draftFrom]
    pick({ mode: 'custom', from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') })
  }

  const applyRollingCustom = () => {
    const count = parseInt(rollingCount, 10)
    if (!Number.isInteger(count) || count < 1 || count > 3650) return
    pick({ mode: 'rolling', unit: rollingUnit, count })
  }

  const isActivePreset = (preset: DateFilterValue) =>
    JSON.stringify(preset) === JSON.stringify(value)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center gap-2 border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground hover:bg-muted/50 transition-all cursor-pointer',
            className,
          )}
        >
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          <span className="whitespace-nowrap">{formatDateFilterValue(value, t, dateLocale)}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        {tabs.length > 1 && (
          <div className="flex items-center gap-1 border-b border-border p-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {tab === 'month' ? t('dateFilter.tabMonth') : tab === 'rolling' ? t('dateFilter.tabRolling') : t('dateFilter.tabCustom')}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'month' && (
          <div className="p-2">
            <MonthPicker
              locale={dateFnsLocale}
              selectedMonth={value.mode === 'month' ? new Date(`${value.month}-01T00:00:00`) : undefined}
              onMonthSelect={(date) => {
                if (!date) return
                pick({ mode: 'month', month: format(date, 'yyyy-MM') })
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 h-8"
              onClick={() => pick({ mode: 'month', month: currentMonth() })}
            >
              {t('dateFilter.thisMonth')}
            </Button>
          </div>
        )}

        {activeTab === 'rolling' && (
          <div className="p-3 w-64">
            <div className="grid grid-cols-2 gap-1.5">
              {modes.includes('all') && (
                <button
                  type="button"
                  onClick={() => pick({ mode: 'all' })}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors text-left',
                    value.mode === 'all'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground hover:bg-muted/50',
                  )}
                >
                  {t('dateFilter.allTime')}
                </button>
              )}
              {ROLLING_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => pick(preset.value)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors text-left',
                    isActivePreset(preset.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground hover:bg-muted/50',
                  )}
                >
                  {formatDateFilterValue(preset.value, t, dateLocale)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground shrink-0">{t('dateFilter.last')}</span>
              <input
                type="number"
                min={1}
                max={3650}
                value={rollingCount}
                onChange={(e) => setRollingCount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyRollingCustom() }}
                className="w-16 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-hidden focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/25"
              />
              <select
                value={rollingUnit}
                onChange={(e) => setRollingUnit(e.target.value as 'days' | 'months' | 'years')}
                className="rounded-md border border-input bg-card px-1.5 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="days">{t('dateFilter.days')}</option>
                <option value="months">{t('dateFilter.months')}</option>
                <option value="years">{t('dateFilter.years')}</option>
              </select>
              <Button size="sm" className="h-7 px-2.5 text-xs ml-auto" onClick={applyRollingCustom}>
                {t('dateFilter.apply')}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1 px-1">{t('dateFilter.from')}</p>
                <Calendar
                  mode="single"
                  locale={dateFnsLocale}
                  selected={draftFrom}
                  defaultMonth={draftFrom}
                  onSelect={setDraftFrom}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1 px-1">{t('dateFilter.to')}</p>
                <Calendar
                  mode="single"
                  locale={dateFnsLocale}
                  selected={draftTo}
                  defaultMonth={draftTo}
                  onSelect={setDraftTo}
                />
              </div>
            </div>
            <div className="flex justify-end mt-2 pt-2 border-t border-border">
              <Button size="sm" className="h-7 px-3 text-xs" disabled={!draftFrom || !draftTo} onClick={applyCustom}>
                {t('dateFilter.apply')}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
