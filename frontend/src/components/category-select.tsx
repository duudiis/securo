import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, ChevronRightIcon, CheckIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import type { Category, CategoryGroup } from '@/types'
import { cn, normalizeText } from '@/lib/utils'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  categories: Category[]
  groups: CategoryGroup[]
  placeholder?: string
  disabled?: boolean
  className?: string
  allowNone?: boolean
  contentProps?: React.ComponentProps<typeof PopoverContent>
}

// Header items carry this prefix as their cmdk value so the filter can keep
// them out of search results (searching lists matching categories directly).
const GROUP_VALUE_PREFIX = '__group__'

export function CategorySelect({
  value,
  onChange,
  categories,
  groups,
  placeholder,
  disabled = false,
  className,
  allowNone = false,
  contentProps,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const { t } = useTranslation()

  const resolvedPlaceholder = placeholder ?? t('transactions.selectCategory', 'Select category')

  const displayGroups = useMemo(() => {
    const ungrouped = (categories ?? []).filter((c) => !c.group_id)
    if (ungrouped.length === 0) return groups

    return [
      ...groups,
      {
        id: 'ungrouped-virtual',
        name: t('groups.noGroup'),
        categories: ungrouped,
      } as CategoryGroup,
    ]
  }, [categories, groups, t])

  const selectedCategory = useMemo(() => {
    return (categories ?? []).find((c) => c.id === value)
  }, [categories, value])

  // Groups start collapsed; typing expands everything (so search always finds
  // categories), and the selected category's group opens pre-expanded.
  const searching = search.trim().length > 0

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSearch('')
      const selectedGroupId = selectedCategory
        ? (selectedCategory.group_id ?? 'ungrouped-virtual')
        : null
      setExpandedGroups(selectedGroupId ? new Set([selectedGroupId]) : new Set())
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-left shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-9 cursor-pointer",
            className
          )}
        >
          <span className="flex items-center gap-2 min-w-0 truncate">
            {selectedCategory ? (
              <>
                {selectedCategory.color ? (
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-black/5"
                    style={{ backgroundColor: selectedCategory.color }}
                  />
                ) : null}
                <span className="truncate">{selectedCategory.name}</span>
              </>
            ) : value === '' && allowNone ? (
              <span className="italic text-muted-foreground truncate">{t('transactions.noCategory')}</span>
            ) : (
              <span className="text-muted-foreground truncate">{resolvedPlaceholder}</span>
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden"
        {...contentProps}
      >
        <Command
          filter={(itemValue, search) => {
            if (itemValue.startsWith(GROUP_VALUE_PREFIX)) return 0
            return normalizeText(itemValue).includes(normalizeText(search)) ? 1 : 0
          }}
        >
          <CommandInput placeholder={t('transactions.searchCategory')} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{t('transactions.noCategoryFound')}</CommandEmpty>
            {allowNone && (
              <CommandGroup>
                <CommandItem
                  value={`none ${t('transactions.noCategory')}`}
                  onSelect={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  className="italic text-muted-foreground cursor-pointer"
                >
                  <span className="flex-1">{t('transactions.noCategory')}</span>
                  {value === '' && <CheckIcon className="size-4 shrink-0" />}
                </CommandItem>
              </CommandGroup>
            )}
            {displayGroups.map((group) => {
              const isExpanded = searching || expandedGroups.has(group.id)
              return (
                <CommandGroup key={group.id}>
                  {!searching && (
                    <CommandItem
                      value={`${GROUP_VALUE_PREFIX}${group.id}`}
                      onSelect={() => toggleGroup(group.id)}
                      className="cursor-pointer"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded
                        ? <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
                        : <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/70" />}
                      <span className="flex-1 truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        ({group.categories.length})
                      </span>
                    </CommandItem>
                  )}
                  {isExpanded && group.categories.map((cat) => (
                    <CommandItem
                      key={cat.id}
                      value={`${group.name} ${cat.name}`}
                      onSelect={() => {
                        onChange(cat.id)
                        setOpen(false)
                      }}
                      className={cn('cursor-pointer', !searching && 'pl-7')}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate flex-1">
                        {cat.color ? (
                          <span
                            className="size-2.5 shrink-0 rounded-full border border-black/5"
                            style={{ backgroundColor: cat.color }}
                          />
                        ) : null}
                        <span className="truncate">{cat.name}</span>
                      </div>
                      {value === cat.id && <CheckIcon className="size-4 shrink-0" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
