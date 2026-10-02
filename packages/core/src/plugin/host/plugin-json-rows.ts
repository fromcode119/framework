import type { IJsonRows } from '@fromcode119/database';
import { LocalizedReadResolver } from '@core/plugin/context/localized-read-resolver';
import type { IPluginProtocolIdentity } from '@core/plugin/host/protocol/interfaces/plugin-protocol-identity.interface';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import { PluginRemoteCallRoot } from '@core/plugin/host/enums/plugin-remote-call-root.enum';

/**
 * Query rows on their way from the api to an isolated plugin as the JSON text Postgres wrote
 * (`findAsJson`), and turned back into rows in the plugin's process.
 *
 * A `context.db.find` from a plugin process used to be parsed into objects in the api, renamed key by
 * key, walked for functions, serialised for the socket and walked again on arrival — for a 20-product
 * listing, most of the api's work per request. The text crosses as it is and is parsed once, where the
 * rows are used. What arrives is what arrived before:
 *
 *  - keys and value types are `find`'s plus camelCase naming (`JsonRowShape` casts what JSON cannot
 *    carry, and `revive` turns timestamps back into the `Date` the `pg` parser gives — same algorithm,
 *    same millisecond — and floats back into numbers);
 *  - `localized: true` fields are collapsed to the request's locale by the same `LocalizedReadResolver`,
 *    with the fields and locale the api resolved, because the plugin process does not know either.
 *
 * Offered only to a plugin process that says it reads it (`ACCEPTS`): a process an api took over from
 * an older release keeps receiving rows.
 */
export class PluginJsonRows {
  /** The option the host adds to a plugin process's `context.db.find` — a symbol, so a plugin cannot send it. */
  static readonly REQUEST: unique symbol = Symbol('fromcode.db.json-rows');
  /** In a process's protocol identity: it decodes `KEY`. */
  static readonly ACCEPTS = 'jsonRows';
  static readonly KEY = '$fcJsonRows';

  private static readonly DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
  private static readonly TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
  private static readonly INFINITY = /^-?infinity$/;

  /**
   * Whether a call is `context.db.find(...)` — directly or through the `stored` / `withArchived` views.
   * The ONLY call answered as JSON rows: the host marks nothing else, and a plugin process decodes
   * nothing else, so another call's answer that happens to carry `KEY` is never read as rows.
   */
  static isDbFind(root: string, steps: IPluginRemoteCall['steps']): boolean {
    const last = steps.length - 1;
    if (root !== String(PluginRemoteCallRoot.CONTEXT.value) || last < 1 || steps[last].name !== 'find' || !steps[last].args) return false;
    if (steps[0]?.name !== 'db' || steps[0].args) return false;
    return steps.slice(1, last).every((step) => !step.args && (step.name === 'stored' || step.name === 'withArchived'));
  }

  /** Whether a plugin process that answered with this protocol identity said it reads JSON rows. */
  static readBy(identity: IPluginProtocolIdentity | null | undefined): boolean {
    return Array.isArray(identity?.accepts) && identity.accepts.includes(PluginJsonRows.ACCEPTS);
  }

  static wrap(rows: IJsonRows, localized: { fields: string[]; locale: string } | null): Record<string, unknown> {
    return { [PluginJsonRows.KEY]: { text: rows.text, revive: rows.revive, localized } };
  }

  static is(value: unknown): boolean {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, PluginJsonRows.KEY);
  }

  static decode(value: unknown): unknown[] {
    const { text, revive, localized } = (value as Record<string, any>)[PluginJsonRows.KEY] as {
      text: string;
      revive: Record<string, 'timestamp' | 'float'>;
      localized: { fields: string[]; locale: string } | null;
    };
    const rows = JSON.parse(text) as Array<Record<string, unknown>>;
    const revived = Object.entries(revive ?? {});
    if (revived.length) {
      for (const row of rows) {
        for (const [key, kind] of revived) {
          const raw = row[key];
          // Only text was cast for revival; a null stays null.
          if (raw === null || raw === undefined) continue;
          row[key] = kind === 'float' ? parseFloat(String(raw)) : PluginJsonRows.timestamp(String(raw));
        }
      }
    }
    return localized?.fields?.length ? LocalizedReadResolver.resolveRows(rows, localized.fields, localized.locale) : rows;
  }

  /**
   * A timestamptz as `pg` reads it (the `postgres-date` algorithm): JSON writes `2026-10-01T19:10:50.481923+00:00`
   * where the row parser reads `2026-10-01 19:10:50.481923+00`, so the separator is put back and the
   * same steps follow — `infinity` as a number, BC years, years 0-99, the offset.
   */
  static timestamp(json: string): Date | number | null {
    if (PluginJsonRows.INFINITY.test(json)) return Number(json.replace('i', 'I'));
    const text = json.replace('T', ' ');
    const matches = PluginJsonRows.DATE_TIME.exec(text);
    if (!matches) return null;
    let year = parseInt(matches[1], 10);
    if (matches[8]) year = -(year - 1);
    const month = parseInt(matches[2], 10) - 1;
    const day = Number(matches[3]);
    const hour = parseInt(matches[4], 10);
    const minute = parseInt(matches[5], 10);
    const second = parseInt(matches[6], 10);
    const ms = matches[7] ? 1000 * parseFloat(matches[7]) : 0;
    const offset = PluginJsonRows.timeZoneOffset(text);
    if (offset === null) {
      const local = new Date(year, month, day, hour, minute, second, ms);
      if (year >= 0 && year < 100) local.setFullYear(year);
      return local;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
    if (year >= 0 && year < 100) date.setUTCFullYear(year);
    if (offset !== 0) date.setTime(date.getTime() - offset);
    return date;
  }

  private static timeZoneOffset(text: string): number | null {
    if (text.endsWith('+00')) return 0;
    const zone = PluginJsonRows.TIME_ZONE.exec(text.split(' ')[1] ?? '');
    if (!zone) return null;
    if (zone[1] === 'Z') return 0;
    const sign = zone[1] === '-' ? -1 : 1;
    return (parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || '0', 10) * 60 + parseInt(zone[4] || '0', 10)) * sign * 1000;
  }
}
