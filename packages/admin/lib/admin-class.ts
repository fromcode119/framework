import { ClientRuntimeConstants } from '@fromcode119/core/client';

/**
 * Class names the admin shares with its stylesheet, composed from the framework's own DOM prefix.
 *
 * The prefix is a framework-wide contract (`ClientRuntimeConstants.DOM_PREFIX`), so it belongs in exactly
 * one place — the same reason `AccountClass` exists. Writing `'fc-surface'` as a literal in a component
 * means the prefix can never change and a typo produces an unstyled element in silence.
 *
 * The stylesheet still spells the names out, because CSS cannot import TypeScript; this is the single
 * authority for what they are.
 */
export class AdminClass {
  /** The raised-panel treatment — the one definition of what a card looks like in this admin. */
  static readonly SURFACE = `${ClientRuntimeConstants.DOM_PREFIX}surface`;

  /** `of('foo')` → `fc-foo`, for any other class the admin shares with `admin.css`. */
  static of(element: string): string {
    return `${ClientRuntimeConstants.DOM_PREFIX}${element}`;
  }
}
