import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PluginDeclarations } from '@core/plugin/host/declarations/plugin-declarations';
import { PluginGuestDeclarations } from '@core/plugin/host/declarations/plugin-guest-declarations';
import { PluginGuestRegistrar } from '@core/plugin/host/registrations/plugin-guest-registrar';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';

/**
 * Every registration-named method on the plugin context must be accounted for: declared (recorded and
 * replayable), persisted by the api itself, already its own registration kind, or not offered to an
 * isolated plugin. A new one that is none of these would be missing, silently, from an api that takes
 * over a running plugin process — this is the test that says so.
 */
describe('PluginDeclarations coverage', () => {
  const OWN_KINDS = [['api', 'registerMiddleware'], ['mcp', 'registerTools'], ['scheduler', 'register']];
  const NOT_OFFERED_TO_ISOLATED = [['attention', 'registerProvider']];

  it('accounts for every register* method on the plugin context', () => {
    const dir = path.resolve(__dirname, '../../../context');
    const found: string[] = [];
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
      const namespace = file.replace(/\.ts$/, '').replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
      for (const match of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/^\s+(register[A-Za-z]*)\s*[:(]/gm)) found.push(`${namespace}.${match[1]}`);
    }
    const accounted = new Set([...PluginDeclarations.CALLS, ...PluginDeclarations.PERSISTED, ...OWN_KINDS, ...NOT_OFFERED_TO_ISOLATED].map(([ns, m]) => `${ns}.${m}`));
    expect(found.length).toBeGreaterThan(10);
    expect(found.filter((name) => !accounted.has(name))).toEqual([]);
  });
});

describe('a declaration made in a plugin process', () => {
  it('is sent as a registration, and recorded so another api can be told it again', async () => {
    const sent: any[] = [];
    const registrar = new PluginGuestRegistrar({ request: async (_type: string, payload: unknown) => { sent.push(payload); return true; } } as any);
    const declarations = new PluginGuestDeclarations((registration) => registrar.send(registration), () => 'handler-1');
    const remoteCalls: string[] = [];
    const collections = declarations.namespace('collections', { find: (...args: unknown[]) => { remoteCalls.push(`find:${args.length}`); return []; } });

    await collections.register({ slug: 'wallets', fields: [{ name: 'balance', type: 'number' }] });
    collections.find('wallets');

    expect(sent).toEqual([{ kind: 'declaration', steps: [{ name: 'collections' }, { name: 'register', args: [{ slug: 'wallets', fields: [{ name: 'balance', type: 'number' }] }] }] }]);
    expect(registrar.snapshot()).toEqual(sent);
    // Anything that is not a declaration is the ordinary remote call it always was.
    expect(remoteCalls).toEqual(['find:1']);
  });

  it('keeps a function argument under a stable id, so a replayed provider still reaches the plugin', async () => {
    const sent: any[] = [];
    const declarations = new PluginGuestDeclarations(async (registration) => { sent.push(registration); return true; }, () => 'kept-7');
    await declarations.declare('entityRecords', 'registerProvider', [{ key: 'orders', list: () => [] }]);
    expect(JSON.stringify(sent[0].steps[1].args)).toContain('kept-7');
  });
});

describe('the api applying a declaration', () => {
  it('runs the call on the plugin context', async () => {
    const ran: unknown[] = [];
    const registrations = new PluginHostRegistrations('probe', {} as any, async () => undefined, async () => undefined, {} as any, async (steps) => { ran.push(steps); });
    const answer = await registrations.apply({} as any, { kind: String(PluginGuestRegistrationKind.DECLARATION.value), steps: [{ name: 'settings' }, { name: 'register', args: [{ fields: [] }] }] });
    expect(ran).toEqual([[{ name: 'settings' }, { name: 'register', args: [{ fields: [] }] }]]);
    expect(answer).toBeUndefined();
  });
});
