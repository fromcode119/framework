import { describe, expect, it } from 'vitest';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';

/**
 * The one derivation the whole panel reads from, so a count and a sentence can never disagree.
 *
 * What is being guarded here is that no sentence appears without a figure in the plan behind it —
 * the page's oldest failure mode was prose that read as fact and was written by the screen.
 */
const table = (overrides: Partial<IImportPlanTable>): IImportPlanTable => ({
  name: 'fcp_alpha_widgets',
  rows: 10,
  mode: 'preserve',
  basis: 'perTenantKey',
  minId: null,
  taken: 4,
  opaqueJsonColumns: [],
  repointedReferences: [],
  droppedColumns: [],
  pluginSlug: 'alpha',
  label: 'Widgets',
  isJournal: false,
  ...overrides,
});

describe('ImportPlanRecord -> outcome', () => {
  it('is NONE for a skipped table, whatever else it carries', () => {
    const record = new ImportPlanRecord(table({ mode: 'skip', droppedColumns: ['old'] }), 0);
    expect(record.outcome).toBe(ImportPlanOutcome.NONE);
  });

  it('is PARTIAL when a column, a moved link or some rows do not come with it', () => {
    expect(new ImportPlanRecord(table({ droppedColumns: ['legacy'] }), 0).outcome).toBe(ImportPlanOutcome.PARTIAL);
    expect(new ImportPlanRecord(table({ mode: 'remap', opaqueJsonColumns: ['metadata.related'] }), 0).outcome).toBe(ImportPlanOutcome.PARTIAL);
    expect(new ImportPlanRecord(table({}), 3).outcome).toBe(ImportPlanOutcome.PARTIAL);
  });

  /**
   * On a real 18,034-row archive this alone moved 39 of 63 kinds out of "something missing" and into
   * "comes across in full" — audit logs, sessions, people. An id inside JSON is only stale if the row
   * it names was re-numbered; where the ids were kept, it points where it always did.
   */
  it('is FULL when an un-followed link sits on a table whose ids were kept', () => {
    const kept = new ImportPlanRecord(table({ mode: 'preserve', opaqueJsonColumns: ['metadata.related'] }), 0);
    expect(kept.hasUnfollowedLinks).toBe(false);
    expect(kept.outcome).toBe(ImportPlanOutcome.FULL);
    expect(kept.answer).toBe('All of them');
    expect(kept.sentences.some((sentence) => sentence.warn)).toBe(false);
  });

  it('is FULL only when nothing is lost', () => {
    expect(new ImportPlanRecord(table({}), 0).outcome).toBe(ImportPlanOutcome.FULL);
  });
});

describe('ImportPlanRecord -> what the operator reads', () => {
  it('nets the excluded rows out of the count, so the tile and the row agree', () => {
    expect(new ImportPlanRecord(table({ rows: 12 }), 10).arrivingRows).toBe(2);
  });

  it('names the add-on a skipped kind is waiting on, from the plan and never from a literal', () => {
    const record = new ImportPlanRecord(table({ mode: 'skip', pluginSlug: 'gamma' }), 0);
    expect(record.answer).toBe('Needs the gamma add-on');
    expect(record.sentences[1].text).toMatch(/Install gamma and import this archive again/);
  });

  it('says nothing about an owner when the plan named none', () => {
    const record = new ImportPlanRecord(table({ mode: 'skip', pluginSlug: null }), 0);
    expect(record.answer).toBe('Nowhere to put these');
    expect(record.sentences.some((sentence) => /add-on/.test(sentence.text))).toBe(false);
  });

  it('produces no loss sentence for a kind that loses nothing', () => {
    const record = new ImportPlanRecord(table({}), 0);
    expect(record.sentences.every((sentence) => !sentence.warn)).toBe(true);
    expect(record.answer).toBe('All of them');
  });

  it('explains a re-numbering as something the operator will not see, and only when it happens', () => {
    const remapped = new ImportPlanRecord(table({ mode: 'remap', minId: 1, taken: 340 }), 0);
    expect(remapped.sentences.map((s) => s.text).join(' ')).toMatch(/you will not see a broken link/);
    expect(new ImportPlanRecord(table({}), 0).sentences).toHaveLength(1);
  });

  it('calls a dropped column a field that is not carried, and promises no substitute', () => {
    const one = new ImportPlanRecord(table({ droppedColumns: ['billing_address_city'] }), 0).sentences.map((s) => s.text).join(' ');
    const many = new ImportPlanRecord(table({ droppedColumns: ['a', 'b', 'c'] }), 0).sentences.map((s) => s.text).join(' ');
    expect(one).toMatch(/One field from an older version has no place on this platform and is not carried/);
    expect(many).toMatch(/3 fields from an older version have no place on this platform and are not carried/);
    for (const text of [one, many]) {
      expect(text).not.toMatch(/setting/i);
      expect(text).not.toMatch(/applies instead/);
    }
  });

  it('marks only the consequences as warnings, never the arrival line', () => {
    const record = new ImportPlanRecord(table({ mode: 'remap', minId: 1, opaqueJsonColumns: ['metadata.related'], droppedColumns: ['legacy'] }), 0);
    expect(record.sentences[0].warn).toBe(false);
    expect(record.sentences.filter((sentence) => sentence.warn)).toHaveLength(2);
  });

  it('keeps every id figure the planner produced, for the Technical disclosure', () => {
    expect(new ImportPlanRecord(table({ mode: 'remap', minId: 1, taken: 1204 }), 0).idMechanics)
      .toBe('Re-numbered — the archive starts at 1, this platform has handed out 1,204');
    expect(new ImportPlanRecord(table({ basis: 'naturalKey' }), 0).idMechanics).toMatch(/keyed naturally/);
    expect(new ImportPlanRecord(table({ basis: 'perTenantKey' }), 0).idMechanics).toMatch(/its own numbering/);
    expect(new ImportPlanRecord(table({ basis: 'aboveSequence', taken: 1204 }), 0).idMechanics).toMatch(/already above/);
    expect(new ImportPlanRecord(table({ mode: 'skip' }), 0).idMechanics).toBe('Not planned — the table is skipped');
  });

  it('renders a nested reference path the way the planner addresses it', () => {
    const record = new ImportPlanRecord(
      table({ repointedReferences: [{ column: 'items', path: ['productId'], targetTable: 'fcp_alpha_products' }] }),
      0,
    );
    expect(record.followedLinks).toEqual(['items[].productId → fcp_alpha_products']);
  });

  it('falls back to the physical name only when the collection declared none', () => {
    expect(new ImportPlanRecord(table({ label: null }), 0).name).toBe('fcp_alpha_widgets');
    expect(new ImportPlanRecord(table({}), 0).name).toBe('Widgets');
  });
});
