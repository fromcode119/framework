import { describe, expect, it } from 'vitest';
import { StickyColumnLayout } from '@/components/ui/sticky-column-layout';
import { Column } from '@/components/ui/column';

/**
 * Pinning a column has one job: keep it readable while the rest of the table scrolls under it.
 *
 * The failure that matters is silent — a pinned column that lands on top of another, or a stale pin
 * that blanks a column — because it looks like a rendering glitch rather than a wrong offset.
 */
const columns = (...ids: string[]): Column<any>[] =>
  ids.map((id) => ({ id, header: id, accessor: id }) as Column<any>);

const idsOf = (list: Column<any>[]): string[] => list.map((column) => String(column.id));

describe('StickyColumnLayout.order', () => {
  it('gathers pinned columns at the left edge instead of pinning them where they sit', () => {
    // Pinning `price` in place would park it at left:0 over `name` and `sku` as soon as anything
    // scrolled under it.
    expect(idsOf(StickyColumnLayout.order(columns('name', 'sku', 'price', 'total'), ['price'])))
      .toEqual(['price', 'name', 'sku', 'total']);
  });

  it('keeps the pinned run in the order the operator pinned it', () => {
    expect(idsOf(StickyColumnLayout.order(columns('a', 'b', 'c'), ['c', 'a'])))
      .toEqual(['c', 'a', 'b']);
  });

  it('leaves the order alone when nothing is pinned', () => {
    expect(idsOf(StickyColumnLayout.order(columns('a', 'b', 'c'), []))).toEqual(['a', 'b', 'c']);
  });

  it('drops a pin whose column is gone rather than blanking a slot', () => {
    // A pin outlives the column it named — the operator hides it, or the schema changes.
    expect(idsOf(StickyColumnLayout.order(columns('a', 'b'), ['removed', 'b'])))
      .toEqual(['b', 'a']);
  });

  it('renders a duplicated pin once', () => {
    expect(idsOf(StickyColumnLayout.order(columns('a', 'b'), ['a', 'a']))).toEqual(['a', 'b']);
  });

  it('never loses or repeats a column, whatever the pins say', () => {
    const ordered = idsOf(StickyColumnLayout.order(columns('a', 'b', 'c', 'd'), ['d', 'x', 'b', 'd']));
    expect([...ordered].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('StickyColumnLayout.pinnedCount', () => {
  it('counts only pins that match a real column', () => {
    expect(StickyColumnLayout.pinnedCount(columns('a', 'b'), ['a', 'gone'])).toBe(1);
  });

  it('is zero when nothing is pinned', () => {
    expect(StickyColumnLayout.pinnedCount(columns('a', 'b'), [])).toBe(0);
  });
});

describe('StickyColumnLayout.leftOffsets', () => {
  it('stacks each pinned cell after the ones before it', () => {
    expect(StickyColumnLayout.leftOffsets([44, 120, 80])).toEqual([0, 44, 164]);
  });

  it('starts flush at the edge for a single pin', () => {
    expect(StickyColumnLayout.leftOffsets([90])).toEqual([0]);
  });

  it('treats an unmeasured width as zero so the run stacks at the edge, not scattered', () => {
    // First paint runs before the header cells can be measured.
    expect(StickyColumnLayout.leftOffsets([NaN, 100])).toEqual([0, 0]);
  });

  it('ignores a negative width rather than pulling later cells backwards', () => {
    expect(StickyColumnLayout.leftOffsets([-50, 100])).toEqual([0, 0]);
  });

  it('returns nothing when nothing is pinned', () => {
    expect(StickyColumnLayout.leftOffsets([])).toEqual([]);
  });
});

describe('StickyColumnLayout.toggle', () => {
  it('appends a new pin so the run keeps pinning order', () => {
    expect(StickyColumnLayout.toggle(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('unpins a column that was pinned', () => {
    expect(StickyColumnLayout.toggle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('ignores a blank column id', () => {
    expect(StickyColumnLayout.toggle(['a'], '   ')).toEqual(['a']);
  });
});
