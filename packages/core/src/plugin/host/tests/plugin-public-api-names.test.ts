import { describe, expect, it } from 'vitest';
import { PluginGuest } from '@core/plugin/host/plugin-guest';
import { PluginHostPublicApi } from '@core/plugin/host/plugin-host-public-api';

/**
 * The method names of another plugin's public API are listed for every peer on every request. A peer's
 * proxy now lists them itself; the answer must be exactly what asking it name by name gave.
 */
describe('function names of a public-API proxy', () => {
  const hostWith = (publicApiKeys: string[] | undefined) => ({ describeResult: publicApiKeys ? { publicApiKeys } : undefined, invoke: () => Promise.resolve(null) });
  const askingEachName = (api: any) => Object.getOwnPropertyNames(api)
    .filter((key) => !['length', 'name', 'prototype', 'caller', 'arguments'].includes(key))
    .filter((key) => typeof api[key] === 'function');

  it('is the list the proxy was described with, the same as asking it name by name', () => {
    const keys = ['priceLines', 'getPricingCapabilities', 'registerProvider', 'length', 'name'];
    const api = PluginHostPublicApi.lazy(hostWith(keys));
    expect(PluginGuest.functionNames(api)).toEqual(askingEachName(api));
    expect(PluginGuest.functionNames(api)).toEqual(['priceLines', 'getPricingCapabilities', 'registerProvider']);
  });

  it('is empty while the peer has not described itself, as before', () => {
    const api = PluginHostPublicApi.lazy(hostWith(undefined));
    expect(PluginGuest.functionNames(api)).toEqual([]);
    expect(askingEachName(api)).toEqual([]);
  });

  it('follows the peer once it has described itself', () => {
    const host: any = hostWith(undefined);
    const api = PluginHostPublicApi.lazy(host);
    expect(PluginGuest.functionNames(api)).toEqual([]);
    host.describeResult = { publicApiKeys: ['a', 'b'] };
    expect(PluginGuest.functionNames(api)).toEqual(['a', 'b']);
  });

  it('still reads a plain object or a class of static methods the way it did', () => {
    class Statics { static first() { return 1; } static second() { return 2; } static notAFunction = 3; }
    expect(PluginGuest.functionNames(Statics)).toEqual(['first', 'second']);
    expect(PluginGuest.functionNames({ run() {}, value: 1 })).toEqual(['run']);
    expect(PluginGuest.functionNames(undefined)).toEqual([]);
  });
});
