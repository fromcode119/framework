import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { PluginJsonRows } from '@core/plugin/host/plugin-json-rows';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';

/**
 * Rows a plugin process decodes from JSON must be the rows the `pg` parser would have handed it. A
 * timestamp is the one value whose JSON form differs from the parser's input, so it is read with the
 * parser's own algorithm — checked here against `postgres-date`, the parser `pg` uses.
 */
const parsePgDate = createRequire(import.meta.url)('postgres-date') as (text: string) => Date | number | null;

const CASES: Array<[json: string, pg: string]> = [
  ['2026-10-01T19:10:50.481923+00:00', '2026-10-01 19:10:50.481923+00'],
  ['2026-10-01T19:10:50+02:00', '2026-10-01 19:10:50+02'],
  ['2026-10-01T19:10:50.4-05:30', '2026-10-01 19:10:50.4-05:30'],
  ['2026-10-01T19:10:50.999999+00:00', '2026-10-01 19:10:50.999999+00'],
  ['0099-06-15T12:00:00+00:00', '0099-06-15 12:00:00+00'],
  ['0001-01-01T00:00:00+00:00 BC', '0001-01-01 00:00:00+00 BC'],
  ['infinity', 'infinity'],
  ['-infinity', '-infinity'],
];

describe('PluginJsonRows', () => {
  it.each(CASES)('reads %s as the pg parser reads its text form', (json, pg) => {
    const ours = PluginJsonRows.timestamp(json);
    const theirs = parsePgDate(pg);
    if (typeof theirs === 'number') expect(ours).toBe(theirs);
    else expect((ours as Date).getTime()).toBe((theirs as Date).getTime());
  });

  it('decodes rows, reviving timestamps and floats and leaving everything else as written', () => {
    const wrapped = PluginJsonRows.wrap({
      text: JSON.stringify([
        { id: 1, at: '2026-10-01T19:10:50.481923+00:00', ratio: 'NaN', price: '19.995', meta: { a: [1, { n: null }] }, gone: null },
        { id: 2, at: null, ratio: '0.1', price: null, meta: null, gone: null },
      ]),
      revive: { at: 'timestamp', ratio: 'float' },
    }, null);
    const [first, second] = PluginJsonRows.decode(wrapped) as any[];
    expect(first.at).toBeInstanceOf(Date);
    expect(first.at.getTime()).toBe(Date.UTC(2026, 9, 1, 19, 10, 50, 481));
    expect(Number.isNaN(first.ratio)).toBe(true);
    expect(first.price).toBe('19.995');
    expect(first.meta).toEqual({ a: [1, { n: null }] });
    expect(second).toEqual({ id: 2, at: null, ratio: 0.1, price: null, meta: null, gone: null });
  });

  it('collapses localized fields to the locale the api resolved', () => {
    const wrapped = PluginJsonRows.wrap({ text: JSON.stringify([{ title: '{"en":"house","bg":"къща"}', body: 'plain' }]), revive: {} }, { fields: ['title', 'body'], locale: 'bg' });
    expect(PluginJsonRows.decode(wrapped)).toEqual([{ title: 'къща', body: 'plain' }]);
  });

  it('is offered only to a process that says it reads it', () => {
    expect(PluginJsonRows.readBy(PluginHostProtocol.identity())).toBe(true);
    expect(PluginJsonRows.readBy({ version: PluginHostProtocol.VERSION, node: process.version })).toBe(false);
    expect(PluginJsonRows.readBy(null)).toBe(false);
    expect(PluginHostProtocol.refusal(PluginHostProtocol.identity())).toBeNull();
  });

  it('recognises only its own wrapper', () => {
    expect(PluginJsonRows.is(PluginJsonRows.wrap({ text: '[]', revive: {} }, null))).toBe(true);
    expect(PluginJsonRows.is([{ [PluginJsonRows.KEY]: 1 }])).toBe(false);
    expect(PluginJsonRows.is({ rows: [] })).toBe(false);
  });
});
