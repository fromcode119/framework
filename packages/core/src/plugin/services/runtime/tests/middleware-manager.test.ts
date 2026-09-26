import { describe, expect, it } from 'vitest';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';
import { MiddlewareStage } from '@core/enums/middleware-stage.enum';

/**
 * Plugin middleware must run whichever way its stage was spelled, and exactly once per plugin and id.
 * An isolated plugin's stand-in carries the `MiddlewareStage` member while the api dispatched with a
 * string, and `===` never matched — so on production no plugin middleware ever ran.
 */
describe('MiddlewareManager', () => {
  const noop = () => undefined;

  it('finds a middleware whether its stage is the member or the string, for either spelling of the dispatch', () => {
    const manager = new MiddlewareManager();
    manager.register({ id: 'member', pluginSlug: 'a', stage: MiddlewareStage.POST_AUTH, handler: noop });
    manager.register({ id: 'string', pluginSlug: 'b', stage: 'post_auth' as any, handler: noop });
    expect(manager.getByStage(MiddlewareStage.POST_AUTH).map((m) => m.id)).toEqual(['member', 'string']);
    expect(manager.getByStage('post_auth' as any).map((m) => m.id)).toEqual(['member', 'string']);
    expect(manager.getByStage(MiddlewareStage.PRE_AUTH)).toEqual([]);
  });

  it('runs a dispatched chain through every matching middleware', async () => {
    const manager = new MiddlewareManager();
    const ran: string[] = [];
    manager.register({ id: 'one', pluginSlug: 'a', stage: MiddlewareStage.POST_AUTH, handler: (_q, _s, next) => { ran.push('one'); next(); } });
    manager.register({ id: 'two', pluginSlug: 'b', stage: 'post_auth' as any, handler: (_q, _s, next) => { ran.push('two'); next(); } });
    await new Promise<void>((resolve) => { void manager.dispatch(MiddlewareStage.POST_AUTH, {}, {}, () => resolve()); });
    expect(ran).toEqual(['one', 'two']);
  });

  it('replaces a plugin middleware registered again under the same id — a restarted plugin process', () => {
    const manager = new MiddlewareManager();
    const before = () => 'old process';
    const after = () => 'new process';
    manager.register({ id: 'gate', pluginSlug: 'finance', stage: MiddlewareStage.POST_AUTH, handler: before });
    manager.register({ id: 'gate', pluginSlug: 'finance', stage: MiddlewareStage.POST_AUTH, handler: after });
    manager.register({ id: 'gate', pluginSlug: 'logistics', stage: MiddlewareStage.POST_AUTH, handler: before });
    const chain = manager.getByStage(MiddlewareStage.POST_AUTH);
    expect(chain.map((m) => m.pluginSlug)).toEqual(['finance', 'logistics']);
    expect(chain[0].handler).toBe(after);
  });
});
