import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A list screen's controls may not disappear in a layout change.
 *
 * The list was rebuilt as one card on 19.11.2026, and the first question asked of it was whether the
 * filters, the column chooser and the columns pinned left and right had survived the rebuild. They
 * had — but nothing except reading the files said so. This is that reading, written down: each
 * control is named with the file that must render it, so a rewrite that drops one fails here instead
 * of being noticed on screen.
 *
 * It is a wiring test, not a looks test: it asserts that a control is still rendered, never how it
 * looks. Appearance is judged in the browser.
 */
const VIEW = join(__dirname, '..', 'view');

const RENDERED: { file: string; must: string[] }[] = [
  // The page is the head, the tools, the table and the count — in that order, in one card.
  { file: 'page-layout.client.tsx', must: ['<ListShell', '<CollectionListHeader', '<CollectionListToolbar', '<CollectionListTable', '<ListFooter'] },
  // What narrows the list and what works on what is selected.
  { file: 'toolbar.client.tsx', must: ['<FilterBar', '<BulkActions'] },
  // Search, the saved filters, the column chooser and the sort live in the filter bar.
  { file: 'filter-bar.client.tsx', must: ['<CollectionColumnsMenu', '<SortMenu', '<ListToolbar'] },
  // The table keeps its pinned columns and its row controls.
  { file: 'table.client.tsx', must: ['<DataTable', 'stickyColumnIds=', 'actions={this.rowActions}', '<CollectionListCards'] },
  // Create, and the slots a plugin adds its own buttons to.
  { file: 'list-header.client.tsx', must: ['admin.collection.list.header.actions', '<Button'] },
];

describe('a collection list keeps its controls', () => {
  for (const { file, must } of RENDERED) {
    it(`${file} still renders ${must.length} of them`, () => {
      const source = readFileSync(join(VIEW, file), 'utf8');
      expect(must.filter((needle) => !source.includes(needle))).toEqual([]);
    });
  }
});
