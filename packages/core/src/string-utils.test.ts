import { describe, expect, it } from 'vitest';
import { StringUtils } from './string-utils';

describe('StringUtils', () => {
  it('recursively normalizes object keys to camelCase', () => {
    expect(StringUtils.toCamelCaseKeysDeep({
      order_number: 'A-1',
      shipping_address: {
        postal_code: '1000',
        address_line_1: 'Main Street',
      },
      line_items: [
        { product_id: 7, unit_price: 9.99 },
      ],
    })).toEqual({
      orderNumber: 'A-1',
      shippingAddress: {
        postalCode: '1000',
        addressLine1: 'Main Street',
      },
      lineItems: [
        { productId: 7, unitPrice: 9.99 },
      ],
    });
  });
});