export type RowId = string | number

export interface TableQuery<T> {
  /** Free-text search across these accessors (case-insensitive substring). */
  search: string
  searchFields: ((row: T) => string | null | undefined)[]
  /** column id -> allowed values; a row passes when its value is in the list (empty list = no filter). */
  filters: Record<string, string[]>
  filterAccessors: Record<string, (row: T) => string>
  sort: { id: string; desc: boolean } | null
  sortAccessors: Record<string, (row: T) => string | number | null | undefined>
}

export function filterRows<T>(rows: T[], q: Pick<TableQuery<T>, 'search' | 'searchFields' | 'filters' | 'filterAccessors'>): T[] {
  const needle = q.search.trim().toLowerCase()
  return rows.filter(row => {
    if (needle && !q.searchFields.some(f => String(f(row) ?? '').toLowerCase().includes(needle))) return false
    for (const [col, allowed] of Object.entries(q.filters)) {
      if (!allowed.length) continue
      const get = q.filterAccessors[col]
      if (!get || !allowed.includes(get(row))) return false
    }
    return true
  })
}

/** Stable, locale-aware sort; nulls always last, numbers numerically, strings with natural numeric order. */
export function sortRows<T>(rows: T[], sort: TableQuery<T>['sort'], accessors: TableQuery<T>['sortAccessors']): T[] {
  if (!sort) return rows
  const get = accessors[sort.id]
  if (!get) return rows
  const dir = sort.desc ? -1 : 1
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((a, b) => {
      const an = a.value === null || a.value === undefined
      const bn = b.value === null || b.value === undefined
      if (an || bn) return an && bn ? a.index - b.index : an ? 1 : -1
      const cmp = typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value
        : String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' })
      return cmp !== 0 ? cmp * dir : a.index - b.index
    })
    .map(x => x.row)
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, pageSize))
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const p = clampPage(page, rows.length, pageSize)
  return rows.slice((p - 1) * pageSize, p * pageSize)
}

/** 1 2 … 5 6 7 … 20 style page list for the pagination control. */
export function pageNumbers(current: number, total: number, siblings = 1): (number | '…')[] {
  const first = 1
  const last = Math.max(1, total)
  const start = Math.max(first + 1, current - siblings)
  const end = Math.min(last - 1, current + siblings)
  const out: (number | '…')[] = [first]
  if (start > first + 1) out.push('…')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < last - 1) out.push('…')
  if (last > first) out.push(last)
  return out
}

/** Counts per option value for a facet, computed on rows that match everything EXCEPT that facet. */
export function facetCounts<T>(rows: T[], column: string, q: Pick<TableQuery<T>, 'search' | 'searchFields' | 'filters' | 'filterAccessors'>): Record<string, number> {
  const withoutThis = { ...q, filters: { ...q.filters, [column]: [] } }
  const get = q.filterAccessors[column]
  const counts: Record<string, number> = {}
  if (!get) return counts
  for (const row of filterRows(rows, withoutThis)) counts[get(row)] = (counts[get(row)] ?? 0) + 1
  return counts
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

export function nextSort(current: { id: string; desc: boolean } | null, id: string): { id: string; desc: boolean } | null {
  if (!current || current.id !== id) return { id, desc: false }
  return current.desc ? null : { id, desc: true }
}
