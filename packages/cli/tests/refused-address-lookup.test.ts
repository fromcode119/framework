import { describe, expect, it } from 'vitest';
import { RefusedAddressLookup } from '@cli/services/refused-address-lookup';

describe('RefusedAddressLookup', () => {
  const both = [{ address: '10.0.0.1', family: 4 }, { address: '10.0.0.2', family: 4 }];

  it('passes over an address that just refused, while another one exists', () => {
    const lookup = new RefusedAddressLookup(async () => both);
    lookup.noteRefused(Object.assign(new Error('refused'), { code: 'ECONNREFUSED', address: '10.0.0.2' }), 1_000);
    expect(lookup.usable(both, 2_000).map((a) => a.address)).toEqual(['10.0.0.1']);
    expect(lookup.usable(both, 1_000 + RefusedAddressLookup.AVOID_MS + 1).map((a) => a.address)).toEqual(['10.0.0.1', '10.0.0.2']);
  });

  it('still uses the only address there is, refusing or not', () => {
    const lookup = new RefusedAddressLookup(async () => both.slice(1));
    lookup.noteRefused(Object.assign(new Error('refused'), { code: 'ECONNREFUSED', address: '10.0.0.2' }), 1_000);
    expect(lookup.usable(both.slice(1), 2_000).map((a) => a.address)).toEqual(['10.0.0.2']);
  });

  it('ignores errors that are not a refused connection', () => {
    const lookup = new RefusedAddressLookup(async () => both);
    lookup.noteRefused(Object.assign(new Error('reset'), { code: 'ECONNRESET', address: '10.0.0.2' }), 1_000);
    expect(lookup.usable(both, 2_000)).toHaveLength(2);
  });

  it('answers an http.Agent lookup, with one address or with all of them', async () => {
    const lookup = new RefusedAddressLookup(async () => both);
    lookup.noteRefused(Object.assign(new Error('refused'), { code: 'ECONNREFUSED', address: '10.0.0.1' }));
    const one = await new Promise<string>((resolve) => lookup.lookup('frontend', {}, (_e, address) => resolve(String(address))));
    expect(one).toBe('10.0.0.2');
    const all = await new Promise<any>((resolve) => lookup.lookup('frontend', { all: true }, (_e, address) => resolve(address)));
    expect(all.map((a: any) => a.address)).toEqual(['10.0.0.2']);
  });
});
