import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventContractRegistry } from '@core/plugin/events/event-contract-registry';

describe('EventContractRegistry', () => {
  afterEach(() => EventContractRegistry.reset());

  it('an undeclared event is never a violation (contracts are opt-in)', () => {
    expect(EventContractRegistry.validate('nobody:declared', { anything: true })).toBeNull();
  });

  it('passes a payload that matches the declared schema and names what is wrong when it does not', () => {
    EventContractRegistry.define({
      event: 'sample-shop:order:completed', owner: 'sample-shop',
      schema: z.object({ orderId: z.number(), orderNumber: z.string() }),
    });
    expect(EventContractRegistry.validate('sample-shop:order:completed', { orderId: 1, orderNumber: 'ORD-1' })).toBeNull();

    const error = EventContractRegistry.validate('sample-shop:order:completed', { orderId: 'nope' });
    expect(error).toContain('orderId');
    expect(error).toContain('orderNumber');
  });

  it('a declared event with no schema is recorded but not constrained', () => {
    EventContractRegistry.define({ event: 'x', owner: 'p' });
    expect(EventContractRegistry.validate('x', 42)).toBeNull();
  });

  it('records the contract, its owner and version, and lists it', () => {
    EventContractRegistry.define({ event: 'e', owner: 'p', version: 2 });
    expect(EventContractRegistry.get('e')).toMatchObject({ event: 'e', owner: 'p', version: 2 });
    expect(EventContractRegistry.all().map((c) => c.event)).toContain('e');
  });

  it('refuses to let one owner overwrite another owner\'s contract (no hijack)', () => {
    const strict = z.object({ orderId: z.number() });
    EventContractRegistry.define({ event: 'sample-shop:order:completed', owner: 'sample-shop', schema: strict });
    // A different plugin tries to redefine it (e.g. with a lax schema) — refused.
    EventContractRegistry.define({ event: 'sample-shop:order:completed', owner: 'attacker', schema: z.any() });
    expect(EventContractRegistry.get('sample-shop:order:completed')).toMatchObject({ owner: 'sample-shop' });
    // The real owner still may upgrade its own contract.
    EventContractRegistry.define({ event: 'sample-shop:order:completed', owner: 'sample-shop', version: 2, schema: strict });
    expect(EventContractRegistry.get('sample-shop:order:completed')).toMatchObject({ owner: 'sample-shop', version: 2 });
  });

  it('is strict everywhere but production, so a drift throws in dev and the gate', () => {
    expect(EventContractRegistry.strict).toBe((process.env.NODE_ENV ?? 'development') !== 'production');
  });
});
