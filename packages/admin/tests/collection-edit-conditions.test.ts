import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';
import { AdminServices } from '@/lib/admin-services';

const fields = [
  { name: 'kind', type: 'select', defaultValue: 'toggle' },
  { name: 'startOn', type: 'checkbox', admin: { condition: { field: 'kind', operator: 'equals', value: 'toggle' } } },
] as never[];

describe('a field shown by another field\'s value', () => {
  const holds = (data: Record<string, unknown>) => AdminServices.getInstance().validation.evaluateCondition(
    { field: 'kind', operator: 'equals', value: 'toggle' }, CollectionEditDerivations.shown(fields, data));

  it('is shown on a new record while the other field shows its default', () => {
    expect(holds({})).toBe(true);
    expect(holds({ kind: '' })).toBe(true);
  });

  it('follows what the operator picked', () => {
    expect(holds({ kind: 'choice' })).toBe(false);
    expect(CollectionEditDerivations.shown(fields, { kind: 'choice' }).kind).toBe('choice');
  });
});
