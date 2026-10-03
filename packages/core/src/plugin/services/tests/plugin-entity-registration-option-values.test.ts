import { describe, expect, it } from 'vitest';
import { PluginEntityRegistrationService } from '@core/plugin/services/plugin-entity-registration-service';

/**
 * An isolated plugin declares select options with Enum members; across the process boundary a member
 * arrives as a plain `{ value, label, … }` object. The console then matched no stored value, printed it
 * raw and found no translation — every status in an mlm list read "pending" in a Bulgarian console.
 */
describe('PluginEntityRegistrationService — select option values', () => {
  const member = (value: string) => ({ value, label: value[0].toUpperCase() + value.slice(1), isTerminal: false });

  it('stores the string a declared member carries, for options and the default', () => {
    const { collection } = new PluginEntityRegistrationService().normalizeForPlugin({
      slug: 'payouts',
      fields: [
        { name: 'status', type: 'select', defaultValue: member('pending'), options: [{ label: 'Pending', value: member('pending') }, { label: 'Paid', value: member('paid') }] },
      ],
    } as any, 'payroll');
    const status = collection.fields.find((field: any) => field.name === 'status') as any;
    expect(status.options.map((option: any) => option.value)).toEqual(['pending', 'paid']);
    expect(status.defaultValue).toBe('pending');
  });

  it('leaves plain values and a json default object alone', () => {
    const { collection } = new PluginEntityRegistrationService().normalizeForPlugin({
      slug: 'items',
      fields: [
        { name: 'size', type: 'select', options: [{ label: 'One', value: 1 }, { label: 'Two', value: 'two' }] },
        { name: 'meta', type: 'json', defaultValue: { value: 'kept', unit: 'kg' } },
      ],
    } as any, 'catalog');
    const [size, meta] = ['size', 'meta'].map((name) => collection.fields.find((field: any) => field.name === name) as any);
    expect(size.options.map((option: any) => option.value)).toEqual([1, 'two']);
    expect(meta.defaultValue).toEqual({ value: 'kept', unit: 'kg' });
  });
});
