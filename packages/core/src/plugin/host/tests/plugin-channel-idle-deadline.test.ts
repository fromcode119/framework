import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginChannel } from '@core/plugin/host/plugin-channel';

/**
 * A lifecycle call is held to a deadline on SILENCE. ecommerce 0.1.376's `onInit` rewrote every product of
 * a 4,800-product shop, calling the host the whole time, and the fixed 60 s deadline cut it off — the update
 * was abandoned and the old code kept serving.
 */
describe('PluginChannel idle deadline', () => {
  afterEach(() => { vi.useRealTimers(); });

  const pair = () => {
    const toHost = new EventEmitter();
    const toGuest = new EventEmitter();
    const host = new PluginChannel({ send: (m) => toGuest.emit('message', m), on: (e, l) => toHost.on(e, l) });
    const guest = new PluginChannel({ send: (m) => toHost.emit('message', m), on: (e, l) => toGuest.on(e, l) });
    host.serve(async () => 'ok');
    return { host, guest };
  };

  it('keeps waiting while the peer keeps calling back, past the deadline', async () => {
    vi.useFakeTimers();
    const { host, guest } = pair();
    let answer: (value: unknown) => void = () => undefined;
    guest.serve(() => new Promise((resolve) => { answer = resolve; }));
    const result = host.request('invoke', {}, 1_000, { idle: true });
    for (let i = 0; i < 5; i += 1) {
      await vi.advanceTimersByTimeAsync(800);
      await guest.request('call', {});
    }
    answer('done');
    await expect(result).resolves.toBe('done');
  });

  it('fails once the peer has been silent for the whole deadline', async () => {
    vi.useFakeTimers();
    const { host, guest } = pair();
    guest.serve(() => new Promise(() => undefined));
    const result = host.request('invoke', {}, 1_000, { idle: true });
    const settled = expect(result).rejects.toThrow('invoke timed out after 1000ms without any activity');
    await vi.advanceTimersByTimeAsync(800);
    await guest.request('call', {});
    await vi.advanceTimersByTimeAsync(1_001);
    await settled;
  });

  it('keeps the fixed deadline for an ordinary request, however busy the peer is', async () => {
    vi.useFakeTimers();
    const { host, guest } = pair();
    guest.serve(() => new Promise(() => undefined));
    const result = host.request('invoke', {}, 1_000);
    const settled = expect(result).rejects.toThrow('invoke timed out after 1000ms');
    await vi.advanceTimersByTimeAsync(800);
    await guest.request('call', {});
    await vi.advanceTimersByTimeAsync(300);
    await settled;
  });
});
