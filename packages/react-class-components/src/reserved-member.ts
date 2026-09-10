/**
 * Member names React.Component owns on every instance. Its constructor ASSIGNS `props`, `context`,
 * `refs` and `updater`, and `setState` writes `state` — so a decorator that installs a getter-only
 * accessor under one of these names makes that assignment throw
 * `TypeError: Cannot set property context of #<X> which has only a getter`,
 * from deep inside React's render, with no hint of which component is at fault.
 *
 * Reject the name at DECORATION time instead: the error then names the class, the member, and the fix.
 */
export class ReservedMember {
  private static readonly NAMES = new Set(['props', 'context', 'refs', 'updater', 'state']);

  /** Throw a self-explaining error if `name` is one React.Component reserves. */
  static assertUsable(decorator: string, target: object, name: string): void {
    if (!ReservedMember.NAMES.has(name)) return;
    const owner = (target as { constructor?: { name?: string } })?.constructor?.name ?? 'component';
    throw new TypeError(
      `${decorator} cannot be used on "${name}" in ${owner}: React.Component owns that member. `
      + `Rename it (e.g. "${name === 'context' ? 'pluginsContext' : `own${name[0].toUpperCase()}${name.slice(1)}`}") — `
      + `otherwise React's constructor assignment throws "Cannot set property ${name} ... which has only a getter".`,
    );
  }
}
