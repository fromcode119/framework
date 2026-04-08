import { describe, expect, it } from 'vitest';
import { RelationshipSelectLocalUtils } from './relationship-select-local-utils';

describe('RelationshipSelectLocalUtils', () => {
  it('creates composite option keys for multi-target relations', () => {
    expect(RelationshipSelectLocalUtils.toOptionKey('7', 'alpha-records')).toBe('alpha-records::7');
  });

  it('parses composite option keys back into target and scalar', () => {
    expect(RelationshipSelectLocalUtils.parseOptionKey('beta-records::12')).toEqual({ relationTo: 'beta-records', scalar: '12' });
  });

  it('builds tagged relationship values for multi-target selections', () => {
    expect(RelationshipSelectLocalUtils.buildTaggedValue(5, 'alpha-records')).toEqual({ id: '5', relationTo: 'alpha-records' });
  });

  it('reads relation targets from tagged relationship values', () => {
    expect(RelationshipSelectLocalUtils.resolveRelationTarget({ id: '3', relationTo: 'beta-records' })).toBe('beta-records');
  });
});