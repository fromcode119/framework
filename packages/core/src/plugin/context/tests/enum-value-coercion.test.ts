import { describe, expect, it } from 'vitest';
import { Enum } from '@fromcode119/reactor';
import { EnumValueCoercion } from '@core/plugin/context/enum-value-coercion';

class OrderStatus extends Enum {
  static readonly PENDING = new OrderStatus('pending');
  static readonly COMPLETED = new OrderStatus('completed');

  private constructor(value: string) {
    super(value);
  }
}

/** Stands in for a reactor Enum loaded through the OTHER half of the dual ESM/CJS package: same
 *  shape and same toJSON contract, but not an instance of the Enum class core imported. */
class ForeignEnumMember {
  constructor(readonly value: string) {}

  toJSON(): string {
    return this.value;
  }
}

describe('EnumValueCoercion', () => {
  it('replaces a top-level Enum member with its string value', () => {
    expect(EnumValueCoercion.coerce(OrderStatus.COMPLETED)).toBe('completed');
  });

  it('replaces Enum members nested in a write payload', () => {
    expect(EnumValueCoercion.coerce({ status: OrderStatus.PENDING, total: 10 }))
      .toEqual({ status: 'pending', total: 10 });
  });

  it('replaces Enum members inside a where clause and nested arrays', () => {
    const where = { and: [{ status: OrderStatus.COMPLETED }, { id: 4 }] };
    expect(EnumValueCoercion.coerce(where)).toEqual({ and: [{ status: 'completed' }, { id: 4 }] });
  });

  it('coerces a member that is structurally an Enum but not instanceof (dual ESM/CJS reactor)', () => {
    // The whole point of the structural fallback: instanceof is false here, and without the fallback
    // this object would be handed to the SQL driver as an object.
    const foreign = new ForeignEnumMember('completed');
    expect(foreign instanceof Enum).toBe(false);
    expect(EnumValueCoercion.coerce({ status: foreign })).toEqual({ status: 'completed' });
  });

  it('does NOT coerce a plain object that merely has a value field', () => {
    const notAnEnum = { value: 'completed', label: 'Completed' };
    expect(EnumValueCoercion.coerce({ option: notAnEnum })).toEqual({ option: notAnEnum });
  });

  it('does NOT coerce an object whose toJSON disagrees with its value field', () => {
    const decoy = { value: 'completed', toJSON: () => 'something-else' };
    expect(EnumValueCoercion.coerce({ decoy })).toEqual({ decoy });
  });

  it('returns the SAME reference when nothing beneath it is an Enum', () => {
    const payload = { status: 'completed', nested: { total: 3 }, list: [1, 2] };
    expect(EnumValueCoercion.coerce(payload)).toBe(payload);
  });

  it('returns a NEW object when something changed, leaving the caller input unmutated', () => {
    const payload = { status: OrderStatus.PENDING };
    const result = EnumValueCoercion.coerce(payload);
    expect(result).not.toBe(payload);
    expect(payload.status).toBe(OrderStatus.PENDING);
  });

  it('passes Dates and Buffers through untouched', () => {
    const date = new Date(0);
    const buf = Buffer.from('x');
    const payload = { createdAt: date, blob: buf, status: OrderStatus.PENDING };
    const result = EnumValueCoercion.coerce(payload) as typeof payload;
    expect(result.createdAt).toBe(date);
    expect(result.blob).toBe(buf);
    expect(result.status).toBe('pending');
  });

  it('leaves class instances alone rather than stripping their prototype', () => {
    class Fragment { constructor(readonly raw: string) {} }
    const fragment = new Fragment('id = ?');
    expect(EnumValueCoercion.coerce({ fragment })).toEqual({ fragment });
    expect((EnumValueCoercion.coerce({ fragment }) as { fragment: Fragment }).fragment).toBeInstanceOf(Fragment);
  });

  it('handles null and undefined without throwing', () => {
    expect(EnumValueCoercion.coerce(null)).toBeNull();
    expect(EnumValueCoercion.coerce(undefined)).toBeUndefined();
    expect(EnumValueCoercion.coerce({ note: null })).toEqual({ note: null });
  });

  it('coerceArguments leaves the table name alone and coerces the rest', () => {
    const args = ['fcp_ecommerce_orders', { id: 1 }, { status: OrderStatus.COMPLETED }];
    expect(EnumValueCoercion.coerceArguments(args))
      .toEqual(['fcp_ecommerce_orders', { id: 1 }, { status: 'completed' }]);
  });

  it('coerceArguments returns the SAME array when no Enum is present', () => {
    const args = ['fcp_ecommerce_orders', { id: 1 }];
    expect(EnumValueCoercion.coerceArguments(args)).toBe(args);
  });
});
