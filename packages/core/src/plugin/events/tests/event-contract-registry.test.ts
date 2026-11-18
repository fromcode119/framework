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
      event: 'ecommerce:order:completed', owner: 'ecommerce',
      schema: z.object({ orderId: z.number(), orderNumber: z.string() }),
    });
    expect(EventContractRegistry.validate('ecommerce:order:completed', { orderId: 1, orderNumber: 'ORD-1' })).toBeNull();

    const error = EventContractRegistry.validate('ecommerce:order:completed', { orderId: 'nope' });
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

  it('is strict everywhere but production, so a drift throws in dev and the gate', () => {
    expect(EventContractRegistry.strict).toBe((process.env.NODE_ENV ?? 'development') !== 'production');
  });
});
