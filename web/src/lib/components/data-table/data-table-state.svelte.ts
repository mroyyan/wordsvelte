import {
  type RowId, type TableQuery, filterRows, sortRows, paginate, pageCount, clampPage, facetCounts, nextSort,
} from './table-logic'

export interface DataTableOptions<T> {
  getId: (row: T) => RowId
  searchFields: TableQuery<T>['searchFields']
  filterAccessors?: TableQuery<T>['filterAccessors']
  sortAccessors?: TableQuery<T>['sortAccessors']
  pageSize?: number
}

/** Reactive client-side table state (search, facet filters, sorting, paging, column visibility, selection). */
export class DataTableState<T> {
  rows = $state.raw<T[]>([])
  search = $state('')
  filters = $state<Record<string, string[]>>({})
  sort = $state<{ id: string; desc: boolean } | null>(null)
  pageIndex = $state(1)
  pageSize = $state(10)
  hidden = $state<Set<string>>(new Set())
  selected = $state<Set<RowId>>(new Set())

  #o: DataTableOptions<T>
  #opt() { return this.#o }

  constructor(options: DataTableOptions<T>) {
    this.#o = options
    if (options.pageSize) this.pageSize = options.pageSize
  }

  #query = $derived({
    search: this.search,
    searchFields: this.#opt().searchFields,
    filters: this.filters,
    filterAccessors: this.#opt().filterAccessors ?? {},
  })

  filtered = $derived(filterRows(this.rows, this.#query))
  sorted = $derived(sortRows(this.filtered, this.sort, this.#opt().sortAccessors ?? {}))
  pages = $derived(pageCount(this.sorted.length, this.pageSize))
  page = $derived(clampPage(this.pageIndex, this.sorted.length, this.pageSize))
  pageRows = $derived(paginate(this.sorted, this.page, this.pageSize))
  isFiltered = $derived(this.search.trim() !== '' || Object.values(this.filters).some(v => v.length > 0))

  allOnPageSelected = $derived(this.pageRows.length > 0 && this.pageRows.every(r => this.selected.has(this.#opt().getId(r))))
  someOnPageSelected = $derived(!this.allOnPageSelected && this.pageRows.some(r => this.selected.has(this.#opt().getId(r))))
  selectedRows = $derived(this.rows.filter(r => this.selected.has(this.#opt().getId(r))))

  setRows(rows: T[]) {
    this.rows = rows
    // Drop selections that no longer exist.
    const ids = new Set(rows.map(this.#opt().getId))
    this.selected = new Set([...this.selected].filter(id => ids.has(id)))
  }

  counts(column: string) { return facetCounts(this.rows, column, this.#query) }
  getId = (row: T) => this.#opt().getId(row)

  setSearch(value: string) { this.search = value; this.pageIndex = 1 }
  setFilter(column: string, values: string[]) { this.filters = { ...this.filters, [column]: values }; this.pageIndex = 1 }
  setPageSize(size: number) { this.pageSize = size; this.pageIndex = 1 }
  goTo(page: number) { this.pageIndex = clampPage(page, this.sorted.length, this.pageSize) }
  toggleSort(id: string) { this.sort = nextSort(this.sort, id); this.pageIndex = 1 }
  setSort(id: string, desc: boolean) { this.sort = { id, desc } }
  clearSort() { this.sort = null }

  isVisible(columnId: string) { return !this.hidden.has(columnId) }
  toggleColumn(columnId: string) {
    const next = new Set(this.hidden)
    next.has(columnId) ? next.delete(columnId) : next.add(columnId)
    this.hidden = next
  }

  reset() { this.search = ''; this.filters = {}; this.pageIndex = 1 }

  isSelected(row: T) { return this.selected.has(this.#opt().getId(row)) }
  toggleRow(row: T) {
    const id = this.#opt().getId(row)
    const next = new Set(this.selected)
    next.has(id) ? next.delete(id) : next.add(id)
    this.selected = next
  }
  toggleAllOnPage() {
    const next = new Set(this.selected)
    const ids = this.pageRows.map(this.#opt().getId)
    if (this.allOnPageSelected) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    this.selected = next
  }
  clearSelection() { this.selected = new Set() }
}
