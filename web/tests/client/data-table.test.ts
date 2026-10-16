import { describe, it, expect } from 'vitest'
import {
  filterRows, sortRows, paginate, pageCount, clampPage, pageNumbers, facetCounts, toggleInList, nextSort,
} from '../../src/lib/components/data-table/table-logic'

interface Row { id: number; name: string; email: string; role: string; age: number | null }
const rows: Row[] = [
  { id: 1, name: 'Alice', email: 'alice@x.test', role: 'admin', age: 30 },
  { id: 2, name: 'bob', email: 'bob@y.test', role: 'editor', age: 25 },
  { id: 3, name: 'Charlie', email: 'charlie@x.test', role: 'author', age: null },
  { id: 4, name: 'dave', email: 'dave@x.test', role: 'author', age: 41 },
  { id: 5, name: 'Item 10', email: 'i10@z.test', role: 'author', age: 2 },
  { id: 6, name: 'Item 2', email: 'i2@z.test', role: 'author', age: 3 },
]
const base = {
  search: '',
  searchFields: [(r: Row) => r.name, (r: Row) => r.email],
  filters: {} as Record<string, string[]>,
  filterAccessors: { role: (r: Row) => r.role },
}
const ids = (rs: Row[]) => rs.map(r => r.id)

describe('filterRows', () => {
  it('returns everything without a query', () => expect(filterRows(rows, base)).toHaveLength(6))

  it('searches case-insensitively across all search fields and trims', () => {
    expect(ids(filterRows(rows, { ...base, search: '  ALICE ' }))).toEqual([1])
    expect(ids(filterRows(rows, { ...base, search: 'y.test' }))).toEqual([2])
    expect(ids(filterRows(rows, { ...base, search: 'nobody' }))).toEqual([])
  })

  it('treats regex/wildcard characters literally', () => {
    expect(filterRows(rows, { ...base, search: '.*' })).toHaveLength(0)
    expect(filterRows(rows, { ...base, search: '(' })).toHaveLength(0)
  })

  it('filters by facet values (OR within a facet) and ignores empty facets', () => {
    expect(ids(filterRows(rows, { ...base, filters: { role: ['admin', 'editor'] } }))).toEqual([1, 2])
    expect(filterRows(rows, { ...base, filters: { role: [] } })).toHaveLength(6)
  })

  it('combines search and facets with AND, and an unknown facet column excludes everything', () => {
    expect(ids(filterRows(rows, { ...base, search: 'x.test', filters: { role: ['author'] } }))).toEqual([3, 4])
    expect(filterRows(rows, { ...base, filters: { nope: ['x'] } })).toHaveLength(0)
  })

  it('tolerates null/undefined search fields', () => {
    expect(filterRows(rows, { ...base, searchFields: [() => null, () => undefined, r => r.name], search: 'bob' })).toHaveLength(1)
  })
})

describe('sortRows', () => {
  const acc = { name: (r: Row) => r.name, age: (r: Row) => r.age }

  it('is a no-op without a sort or for unknown columns, and never mutates the input', () => {
    const copy = [...rows]
    expect(sortRows(rows, null, acc)).toBe(rows)
    expect(sortRows(rows, { id: 'zzz', desc: false }, acc)).toBe(rows)
    sortRows(rows, { id: 'name', desc: true }, acc)
    expect(rows).toEqual(copy)
  })

  it('sorts strings case-insensitively with natural number order', () => {
    expect(sortRows(rows, { id: 'name', desc: false }, acc).map(r => r.name)).toEqual(['Alice', 'bob', 'Charlie', 'dave', 'Item 2', 'Item 10'])
    expect(sortRows(rows, { id: 'name', desc: true }, acc).map(r => r.name)).toEqual(['Item 10', 'Item 2', 'dave', 'Charlie', 'bob', 'Alice'])
  })

  it('sorts numbers numerically and always puts nulls last (both directions)', () => {
    expect(ids(sortRows(rows, { id: 'age', desc: false }, acc))).toEqual([5, 6, 2, 1, 4, 3])
    expect(ids(sortRows(rows, { id: 'age', desc: true }, acc))).toEqual([4, 1, 2, 6, 5, 3])
  })

  it('is stable for equal keys', () => {
    expect(ids(sortRows(rows, { id: 'role', desc: false }, { role: r => r.role }))).toEqual([1, 3, 4, 5, 6, 2])
  })
})

describe('paging', () => {
  it('pageCount is at least 1 and rounds up', () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(pageCount(10, 10)).toBe(1)
    expect(pageCount(11, 10)).toBe(2)
    expect(pageCount(5, 0)).toBe(5) // a zero page size is treated as 1
  })

  it('clampPage keeps the page inside 1..pages (also for NaN/negative/fractions)', () => {
    expect(clampPage(0, 25, 10)).toBe(1)
    expect(clampPage(-3, 25, 10)).toBe(1)
    expect(clampPage(99, 25, 10)).toBe(3)
    expect(clampPage(NaN, 25, 10)).toBe(1)
    expect(clampPage(2.9, 25, 10)).toBe(2)
  })

  it('paginate slices and clamps out-of-range pages (e.g. after filtering)', () => {
    const data = Array.from({ length: 25 }, (_, i) => i + 1)
    expect(paginate(data, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(paginate(data, 3, 10)).toEqual([21, 22, 23, 24, 25])
    expect(paginate(data, 50, 10)).toEqual([21, 22, 23, 24, 25])
    expect(paginate([], 1, 10)).toEqual([])
  })

  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [1, 10, [1, 2, '…', 10]],
    [5, 10, [1, '…', 4, 5, 6, '…', 10]],
    [10, 10, [1, '…', 9, 10]],
    [2, 4, [1, 2, 3, 4]],
  ])('pageNumbers(%i of %i)', (cur, total, expected) => {
    expect(pageNumbers(cur as number, total as number)).toEqual(expected)
  })
})

describe('facetCounts', () => {
  it('counts options ignoring that facet own selection but respecting search and other facets', () => {
    const q = { ...base, filters: { role: ['admin'] } }
    expect(facetCounts(rows, 'role', q)).toEqual({ admin: 1, editor: 1, author: 4 }) // admin selection does not hide other options
    expect(facetCounts(rows, 'role', { ...q, search: 'x.test' })).toEqual({ admin: 1, author: 2 })
    expect(facetCounts(rows, 'unknown', q)).toEqual({})
  })
})

describe('small helpers', () => {
  it('toggleInList adds and removes without mutating', () => {
    const a = ['x']
    expect(toggleInList(a, 'y')).toEqual(['x', 'y'])
    expect(toggleInList(a, 'x')).toEqual([])
    expect(a).toEqual(['x'])
  })

  it('nextSort cycles asc -> desc -> off and resets when the column changes', () => {
    let s = nextSort(null, 'a')
    expect(s).toEqual({ id: 'a', desc: false })
    s = nextSort(s, 'a'); expect(s).toEqual({ id: 'a', desc: true })
    s = nextSort(s, 'a'); expect(s).toBeNull()
    expect(nextSort({ id: 'a', desc: true }, 'b')).toEqual({ id: 'b', desc: false })
  })
})
