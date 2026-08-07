import { describe, expect, it } from 'vitest';
import { CollectionEditDirtyState } from '@/components/collection/edit/view/collection-edit-dirty-state.client';

describe('CollectionEditDirtyState', () => {
  const record = { id: 1, name: 'Box', dimensions: { length: '0', unit: 'metric' }, tags: ['a', 'b'] };

  it('a just-loaded record is NOT dirty — the save bar used to claim unsaved changes on every open', () => {
    // The lifecycle seeds formData and pristineFormData from the same normalized object.
    expect(CollectionEditDirtyState.isDirty(record, record, false)).toBe(false);
  });

  it('an equal-but-separate object is NOT dirty — a component rewriting the same value is not an edit', () => {
    const rewritten = { id: 1, name: 'Box', dimensions: { length: '0', unit: 'metric' }, tags: ['a', 'b'] };

    expect(CollectionEditDirtyState.isDirty(rewritten, record, false)).toBe(false);
  });

  it('key ORDER is not a change', () => {
    const reordered = { tags: ['a', 'b'], dimensions: { unit: 'metric', length: '0' }, name: 'Box', id: 1 };

    expect(CollectionEditDirtyState.isDirty(reordered, record, false)).toBe(false);
  });

  it('null and undefined and a missing key all compare equal — wire artefacts are not edits', () => {
    expect(CollectionEditDirtyState.isDirty({ a: null }, { a: undefined }, false)).toBe(false);
    expect(CollectionEditDirtyState.isDirty({ a: undefined }, {}, false)).toBe(false);
    expect(CollectionEditDirtyState.isDirty({}, { a: null }, false)).toBe(false);
  });

  it('detects a real edit at the top level', () => {
    expect(CollectionEditDirtyState.isDirty({ ...record, name: 'Box 2' }, record, false)).toBe(true);
  });

  it('detects a real edit NESTED in an object — the package-dimensions case', () => {
    const edited = { ...record, dimensions: { length: '12', unit: 'metric' } };

    expect(CollectionEditDirtyState.isDirty(edited, record, false)).toBe(true);
  });

  it('detects array edits, including order and length', () => {
    expect(CollectionEditDirtyState.isDirty({ ...record, tags: ['b', 'a'] }, record, false)).toBe(true);
    expect(CollectionEditDirtyState.isDirty({ ...record, tags: ['a'] }, record, false)).toBe(true);
    expect(CollectionEditDirtyState.isDirty({ ...record, tags: ['a', 'b', 'c'] }, record, false)).toBe(true);
  });

  it('does not treat a type change as equal (0 vs "0", false vs null)', () => {
    expect(CollectionEditDirtyState.isDirty({ a: 0 }, { a: '0' }, false)).toBe(true);
    expect(CollectionEditDirtyState.isDirty({ a: false }, { a: null }, false)).toBe(true);
  });

  it('a NEW entry is always dirty — nothing exists on the server yet', () => {
    expect(CollectionEditDirtyState.isDirty({}, null, true)).toBe(true);
  });

  it('claims nothing when no snapshot exists — a failed load must not accuse the operator', () => {
    expect(CollectionEditDirtyState.isDirty(record, null, false)).toBe(false);
  });
});
