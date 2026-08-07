import { describe, expect, it } from 'vitest';
import { Reactor } from '../src/reactor';
import { state } from '../src/state.decorator';
import { PureReactor } from '../src/pure-reactor';

/**
 * `@state` must READ BACK what you just wrote — that is the whole point of the decorator, which
 * documents assignment as "read and assign it like a normal property" and advertises `this.count++`.
 *
 * Post-mount the setter routes through `setState`, which React commits ASYNCHRONOUSLY, so a plain
 * `get() { return this.state[key] }` hands back the PREVIOUS value for the rest of the tick. That is
 * not academic: every admin detail page does
 *
 *     this.routeSlug = params.slug;      // post-mount write -> setState, not yet committed
 *     void Controller.fetch(this);       // reads this.routeSlug -> '' (the initialiser)
 *
 * and shipped a request to `/api/v1/themes//config` — a 404 that took out the whole theme page.
 *
 * The fix must NOT be "mutate `this.state` in place first": that is what the setter used to do, and it
 * made the change invisible to `PureReactor.shouldComponentUpdate` (which compares `this.state` to
 * `nextState`), so `@state` was silently dead on every PureReactor. Both properties are asserted here.
 */

/** React's updater contract, with the commit deferred exactly as React defers it. */
class DeferredUpdater {
  private readonly queue: Array<{ instance: any; partial: object; callback?: () => void }> = [];

  enqueueSetState(instance: any, partial: object, callback?: () => void): void {
    this.queue.push({ instance, partial, callback });
  }

  /** Commit every queued update, then fire the callbacks — React's order. */
  flush(): void {
    const pending = this.queue.splice(0, this.queue.length);
    for (const entry of pending) entry.instance.state = { ...entry.instance.state, ...entry.partial };
    for (const entry of pending) entry.callback?.();
  }
}

class DetailPage extends Reactor {
  @state routeSlug = '';
  @state count = 0;

  render(): null {
    return null;
  }
}

class PureCounter extends PureReactor {
  @state count = 0;

  render(): null {
    return null;
  }
}

const mount = <T extends Reactor>(instance: T): DeferredUpdater => {
  const updater = new DeferredUpdater();
  (instance as unknown as { updater: unknown }).updater = updater;
  instance.render();
  instance.componentDidMount?.();
  return updater;
};

describe('Reactor @state read-after-write', () => {
  it('reads back a value written after mount, before React commits it', () => {
    const page = new DetailPage({});
    mount(page);

    page.routeSlug = 'vselenskiportal88';

    expect(page.routeSlug).toBe('vselenskiportal88');
  });

  it('does not mutate this.state before the commit, so PureReactor still sees the change', () => {
    const counter = new PureCounter({});
    const updater = mount(counter);
    const stateBefore = counter.state;

    counter.count = 7;

    expect((counter.state as { count: number }).count).toBe(0);
    expect(counter.state).toBe(stateBefore);
    expect(counter.shouldComponentUpdate({}, { count: 7 } as never)).toBe(true);
    updater.flush();
    expect(counter.count).toBe(7);
  });

  it('supports repeated read-modify-write in one tick (this.count++ twice adds two)', () => {
    const page = new DetailPage({});
    const updater = mount(page);

    page.count++;
    page.count++;

    expect(page.count).toBe(2);
    updater.flush();
    expect(page.count).toBe(2);
    expect((page.state as { count: number }).count).toBe(2);
  });

  it('lets a later direct setState win over the pending accessor write', () => {
    const page = new DetailPage({});
    const updater = mount(page);

    page.routeSlug = 'from-accessor';
    page.setState({ routeSlug: 'from-set-state' } as never);
    updater.flush();

    expect(page.routeSlug).toBe('from-set-state');
  });
});
