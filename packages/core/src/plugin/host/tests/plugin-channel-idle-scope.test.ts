import { describe, it, expect } from 'vitest';
import { PluginChannel } from '@core/plugin/host/plugin-channel';

const channel = () => new PluginChannel({ send: () => undefined, on: () => undefined });

describe('PluginChannel idle request scope', () => {
  it('keeps a request alive only while ITS OWN activity record is busy', async () => {
    let busy = true;
    const c = channel();
    const started = Date.now();
    const pending = c.request('invoke', {}, 40, { idle: true, quietFor: () => (busy ? 0 : Infinity) }).catch((e: Error) => e);
    setTimeout(() => { busy = false; }, 120);
    const error = await pending;
    expect(String(error)).toMatch(/without any activity/);
    expect(Date.now() - started).toBeGreaterThanOrEqual(110);
  });

  it('never outlives its ceiling, however busy it stays', async () => {
    const c = channel();
    const started = Date.now();
    const error = await c.request('invoke', {}, 20, { idle: true, quietFor: () => 0, maxMs: 80 }).catch((e: Error) => e);
    expect(String(error)).toMatch(/ceiling/);
    expect(Date.now() - started).toBeLessThan(200);
  });
});
