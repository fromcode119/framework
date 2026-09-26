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

describe('the core registries a plugin process fills', () => {
  it('reach the api only as declarations — none as a bare call a new api would never hear of', () => {
    const bridge = fs.readFileSync(path.resolve(__dirname, '../../plugin-guest-core-bridge.ts'), 'utf8');
    expect(bridge).not.toMatch(/remote\.call\('core'/);
    for (const [registry, method] of PluginDeclarations.CORE_CALLS) expect(bridge).toContain(`declarations.declare('${registry}', '${method}'`);
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

    expect(sent).toEqual([{ kind: 'declaration', root: 'context', steps: [{ name: 'collections' }, { name: 'register', args: [{ slug: 'wallets', fields: [{ name: 'balance', type: 'number' }] }] }] }]);
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
    const roots: unknown[] = [];
    const registrations = new PluginHostRegistrations('probe', {} as any, async () => undefined, async () => undefined, {} as any, async (steps, root) => { ran.push(steps); roots.push(root); });
    const answer = await registrations.apply({} as any, { kind: String(PluginGuestRegistrationKind.DECLARATION.value), steps: [{ name: 'settings' }, { name: 'register', args: [{ fields: [] }] }] });
    expect(ran).toEqual([[{ name: 'settings' }, { name: 'register', args: [{ fields: [] }] }]]);
    expect(answer).toBeUndefined();
    await registrations.apply({} as any, { kind: String(PluginGuestRegistrationKind.DECLARATION.value), root: 'core', steps: [{ name: 'assistantVocabulary' }, { name: 'register', args: ['k', 'r', []] }] });
    expect(roots).toEqual([undefined, 'core']);
  });
});

describe('the same declaration made again', () => {
  it('with a new function handle, replaces the one it repeats where it stood — the newest is in force', async () => {
    const registrar = new PluginGuestRegistrar({ request: async () => true } as any);
    const send = (handle: string) => registrar.send({ kind: 'declaration', steps: [{ name: 'integrations' }, { name: 'registerProvider', args: ['payments', { key: 'card', create: { $fcCallback: handle } }] }] });
    await registrar.send({ kind: 'declaration', steps: [{ name: 'collections' }, { name: 'register', args: [{ slug: 'first' }] }] });
    await send('callback:1');
    await registrar.send({ kind: 'declaration', steps: [{ name: 'collections' }, { name: 'register', args: [{ slug: 'last' }] }] });
    await send('callback:2');
    expect(registrar.snapshot().map((r) => JSON.stringify(r.steps?.[1].args))).toEqual([
      JSON.stringify([{ slug: 'first' }]),
      JSON.stringify(['payments', { key: 'card', create: { $fcCallback: 'callback:2' } }]),
      JSON.stringify([{ slug: 'last' }]),
    ]);
  });

  it('suppressed during a per-site pass, leaves the one that stands untouched', async () => {
    let answer: unknown = true;
    const registrar = new PluginGuestRegistrar({ request: async () => answer } as any);
    const steps = (handle: string) => [{ name: 'integrations' }, { name: 'registerProvider', args: ['payments', { key: 'card', create: { $fcCallback: handle } }] }];
    await registrar.send({ kind: 'declaration', steps: steps('callback:1') });
    answer = PluginGuestRegistrar.SUPPRESSED;
    await registrar.send({ kind: 'declaration', steps: steps('callback:9') });
    expect(JSON.stringify(registrar.snapshot()[0].steps)).toContain('callback:1');
    expect(registrar.snapshot()).toHaveLength(1);
  });

  it('is sent each time, but kept once — the record does not grow with every api that takes the process over', async () => {
    const sent: unknown[] = [];
    const registrar = new PluginGuestRegistrar({ request: async (_type: string, payload: unknown) => { sent.push(payload); return true; } } as any);
    const declarations = new PluginGuestDeclarations((registration) => registrar.send(registration), () => 'kept-1');
    for (let round = 0; round < 3; round += 1) await declarations.declare('integrations', 'registerProvider', ['payments', { key: 'card' }]);
    await declarations.declare('integrations', 'registerProvider', ['payments', { key: 'transfer' }]);
    expect(sent).toHaveLength(4);
    expect(registrar.snapshot().map((r) => (r.steps?.[1].args?.[1] as { key: string }).key)).toEqual(['card', 'transfer']);
  });
});
