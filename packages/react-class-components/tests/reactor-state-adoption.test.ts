import { describe, expect, it } from 'vitest';
import { Reactor } from '../src/reactor';
import { state } from '../src/state.decorator';

/**
 * `@state` field defaults vs a constructor that assigns `this.state`.
 *
 * Under define semantics (what Next/SWC emits) a `@state` field initializer becomes an OWN data property
 * that shadows the prototype accessor, so `Reactor` adopts it into `this.state` on the first render. That
 * adoption must not overwrite a value the CONSTRUCTOR put in `this.state` — the field initializer is the
 * default, the constructor is the explicit override. Getting this backwards silently reverted the account
 * shell's section on every direct load of `/account/:section`.
 *
 * vitest compiles with `useDefineForClassFields: false`, so the own property is installed explicitly here
 * to reproduce exactly what the define-semantics emit produces.
 */
class DefineSemanticsShell extends Reactor {
  @state section: string = '';

  constructor(props: Record<string, unknown>, initial: string) {
    super(props);
    Object.defineProperty(this, 'section', { value: '', writable: true, configurable: true, enumerable: true });
    this.state = { section: initial };
  }

  render(): null {
    return null;
  }
}

class DefaultOnlyShell extends Reactor {
  @state open: boolean = true;

  constructor(props: Record<string, unknown>) {
    super(props);
    Object.defineProperty(this, 'open', { value: true, writable: true, configurable: true, enumerable: true });
  }

  render(): null {
    return null;
  }
}

describe('Reactor @state adoption', () => {
  it('keeps the value the constructor assigned to this.state', () => {
    const shell = new DefineSemanticsShell({}, 'orders');

    shell.render();

    expect(shell.section).toBe('orders');
    expect((shell.state as { section: string }).section).toBe('orders');
    expect(Object.prototype.hasOwnProperty.call(shell, 'section')).toBe(false);
  });

  it('still adopts the field default when the constructor set no state for that key', () => {
    const shell = new DefaultOnlyShell({});

    shell.render();

    expect(shell.open).toBe(true);
    expect((shell.state as { open: boolean }).open).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(shell, 'open')).toBe(false);
  });
});
