import { describe, expect, it } from 'vitest';
import { Reactor } from '../src/reactor';
import { state } from '../src/state.decorator';

/**
 * A component that awaits something in `componentDidMount` writes its `@state` when the answer comes,
 * which can be after it is gone: the person navigated away, or a test finished and its DOM was torn down.
 * That write must not reach React — with the environment gone, React's update scheduler reads `window` and
 * throws, which failed a release's test run although every test had passed.
 */
class LateLoader extends Reactor {
  @state resolved = false;

  render(): null {
    return null;
  }
}

describe('a @state write after unmount', () => {
  it('is dropped instead of being sent to React', () => {
    const calls: object[] = [];
    const component = new LateLoader({});
    (component as unknown as { updater: unknown }).updater = { enqueueSetState: (_: unknown, partial: object) => calls.push(partial) };
    component.render();
    component.componentDidMount?.();
    component.resolved = true;
    expect(calls).toEqual([{ resolved: true }]);

    component.componentWillUnmount?.();
    component.resolved = false;
    expect(calls).toHaveLength(1);
  });
});
