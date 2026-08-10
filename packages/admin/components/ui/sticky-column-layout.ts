import { Column } from '@/components/ui/column';

/**
 * Where a table's pinned columns sit once the table scrolls sideways.
 *
 * Pinned columns are MOVED to the left edge rather than pinned where they happen to sit. Pinning the
 * third column in place would park it at `left: 0` on top of the first two the moment anything
 * scrolled under it — the operator pins a column to keep it readable and gets an overlap instead.
 * Gathering them into a run at the edge is what every spreadsheet does, and it makes the offsets a
 * plain cumulative sum.
 *
 * Offsets are measured, not declared: the table lays out `auto`, so a column's width is whatever its
 * content needs and no static value can know it.
 */
export class StickyColumnLayout {
  /**
   * `columns` reordered so the pinned ones lead, in the order they were pinned.
   *
   * An id that no longer matches a column is dropped rather than treated as missing data — a pin
   * outlives the column it named (the operator hides that column, or the collection's schema changes)
   * and a stale id must not blank a column or shift the rest.
   */
  static order<T>(columns: Column<T>[], stickyIds: string[]): Column<T>[] {
    const pinnedIds = StickyColumnLayout.normalizeIds(stickyIds);
    const byId = new Map(columns.map((column) => [String(column.id), column]));

    const pinned: Column<T>[] = [];
    for (const id of pinnedIds) {
      const column = byId.get(id);
      if (column) pinned.push(column);
    }

    const isPinned = new Set(pinned.map((column) => String(column.id)));
    return [...pinned, ...columns.filter((column) => !isPinned.has(String(column.id)))];
  }

  /** How many of the ORDERED columns are pinned — i.e. the length of the leading run. */
  static pinnedCount<T>(columns: Column<T>[], stickyIds: string[]): number {
    const available = new Set(columns.map((column) => String(column.id)));
    return StickyColumnLayout.normalizeIds(stickyIds).filter((id) => available.has(id)).length;
  }

  /**
   * Left offset in px for each cell in the pinned run, given the measured widths of the cells that
   * precede it — the selection checkbox included, since it is pinned too and occupies the edge.
   *
   * A width that has not been measured yet counts as 0, so the run stacks at the edge for one frame
   * rather than scattering across the table.
   */
  static leftOffsets(widths: number[]): number[] {
    const offsets: number[] = [];
    let running = 0;
    for (const width of widths) {
      offsets.push(running);
      running += Math.max(0, Number(width) || 0);
    }
    return offsets;
  }

  /** Adding a pin appends, so the pinned run keeps the order the operator pinned in. */
  static toggle(stickyIds: string[], columnId: string): string[] {
    const id = String(columnId || '').trim();
    if (!id) return StickyColumnLayout.normalizeIds(stickyIds);

    const current = StickyColumnLayout.normalizeIds(stickyIds);
    return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
  }

  private static normalizeIds(stickyIds: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of Array.isArray(stickyIds) ? stickyIds : []) {
      const id = String(value ?? '').trim();
      // A duplicate would render the same column twice and double-count its width in every offset
      // after it, pushing the whole pinned run out of the viewport.
      if (!id || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
    }
    return normalized;
  }
}
