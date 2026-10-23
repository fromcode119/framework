import { describe, expect, it } from 'vitest';
import { ListArrangement } from '@/components/collection/list/list-arrangement';
import { ListGroup } from '@/components/collection/list/list-group';

const groups = [new ListGroup('2', 'Self-love'), new ListGroup('1', 'Work'), new ListGroup('7', 'Sleep')];
const arrangement = new ListArrangement('group', 'sortOrder', groups, 'No group');

const rows = [
  { id: 1, group: 1, sortOrder: 1 },
  { id: 2, group: 2, sortOrder: 2 },
  { id: 3, group: null, sortOrder: 0 },
  { id: 4, group: 2, sortOrder: 1 },
  { id: 5, group: 2, sortOrder: 1 },
  { id: 6, group: 9, sortOrder: 0 },
];

describe('ListArrangement', () => {
  it('orders by the groups, unknown groups after them, no group last, then by the order field with the id as tie-break', () => {
    expect(arrangement.arrange(rows, true).map((row) => row.id)).toEqual([4, 5, 2, 1, 6, 3]);
  });

  it('keeps the incoming order inside a group when the list is not sorted by the order field', () => {
    expect(arrangement.arrange(rows, false).map((row) => row.id)).toEqual([2, 4, 5, 1, 6, 3]);
  });

  it('labels a group by its name, an unknown group by its id, and no group by the stated label', () => {
    expect(arrangement.labelOf('2')).toBe('Self-love');
    expect(arrangement.labelOf('9')).toBe('#9');
    expect(arrangement.labelOf('')).toBe('No group');
  });

  it('splits the records into sections, leaving out empty groups unless asked to show them', () => {
    const shown = arrangement.arrange(rows, true);
    const summary = (includeEmpty: boolean) => arrangement.sections(shown, includeEmpty)
      .map((section) => [section.id, section.label, section.rows.map((row) => row.id)]);
    expect(summary(false)).toEqual([
      ['group:2', 'Self-love', [4, 5, 2]],
      ['group:1', 'Work', [1]],
      ['group:9', '#9', [6]],
      ['group:', 'No group', [3]],
    ]);
    expect(summary(true)).toEqual([
      ['group:2', 'Self-love', [4, 5, 2]],
      ['group:1', 'Work', [1]],
      ['group:7', 'Sleep', []],
      ['group:9', '#9', [6]],
      ['group:', 'No group', [3]],
    ]);
  });

  it('puts a record dropped on a heading at the start of that group, empty or not', () => {
    const shown = arrangement.arrange(rows, true);
    expect(arrangement.move(shown, '1', 'group:7', false).map((change) => [change.id, change.data]))
      .toEqual([['1', { group: '7' }]]);
    const intoSelfLove = arrangement.move(shown, '3', 'group:2', false);
    expect(intoSelfLove.find((change) => change.id === '3')?.data).toEqual({ group: '2' });
    expect(intoSelfLove.map((change) => change.id)).toEqual(['3', '5', '2']); // 3,4,5,2 → 0,1,2,3: 4 keeps its 1
    // 1 goes above 3 among the ungrouped: 1,3 → 0,1.
    expect(arrangement.move(shown, '1', 'group:', false).map((change) => [change.id, change.data]))
      .toEqual([['1', { sortOrder: 0, group: null }], ['3', { sortOrder: 1 }]]);
  });

  it('reuses the group\'s numbers and changes only the records that move', () => {
    const shown = arrangement.arrange(rows, true); // 4(1) 5(1) 2(2) | 1(1) | 6 | 3
    const changes = arrangement.move(shown, '2', '4', false);
    // 2,4,5 → values 1,2,3 made strictly increasing from the pool [1,1,2].
    expect(changes.map((change) => [change.id, change.data])).toEqual([
      ['2', { sortOrder: 1 }],
      ['4', { sortOrder: 2 }],
      ['5', { sortOrder: 3 }],
    ]);
  });

  it('moves a record into another group, taking that group', () => {
    const shown = arrangement.arrange(rows, true);
    const changes = arrangement.move(shown, '1', '5', true);
    expect(changes.find((change) => change.id === '1')?.data).toEqual({ sortOrder: 3, group: '2' }) // 4,5,1,2 → 1,2,3,4;
  });

  it('clears the group when a record is dropped among the ungrouped ones', () => {
    const shown = arrangement.arrange(rows, true);
    const changes = arrangement.move(shown, '1', '3', false);
    expect(changes.find((change) => change.id === '1')?.data).toMatchObject({ group: null });
  });

  it('steps past a neighbour inside a group, to the edge of the next section across one, and into an empty one by its heading', () => {
    const sections = arrangement.sections(arrangement.arrange(rows, true), true);
    expect(arrangement.step(sections, '5', true)).toEqual({ overId: '4', after: false });
    expect(arrangement.step(sections, '2', false)).toEqual({ overId: '1', after: false });
    expect(arrangement.step(sections, '1', true)).toEqual({ overId: '2', after: true });
    expect(arrangement.step(sections, '1', false)).toEqual({ overId: 'group:7', after: false });
    expect(arrangement.step(sections, '6', true)).toEqual({ overId: 'group:7', after: false });
    expect(arrangement.step(sections, '4', true)).toBeNull();
    expect(arrangement.step(sections, '3', false)).toBeNull();
  });
});
