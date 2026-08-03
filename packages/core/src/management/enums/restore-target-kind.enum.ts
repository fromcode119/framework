import { Enum } from '@fromcode119/reactor';

/**
 * What a restore operation targets.
 *
 * This was a template-literal union — `'system' | \`plugin:${string}\` | \`theme:${string}\`` — which
 * crammed a KIND and a SLUG into one string, so every consumer hand-parsed it with `startsWith('plugin:')`
 * and `slice('plugin:'.length)`. The kind is an enum; the slug belongs beside it (see `RestoreTarget`).
 */
export class RestoreTargetKind extends Enum {
  static readonly SYSTEM = new RestoreTargetKind('system');
  static readonly PLUGIN = new RestoreTargetKind('plugin');
  static readonly THEME = new RestoreTargetKind('theme');

  private constructor(value: string) {
    super(value);
  }

  /** True when this kind names one installable unit and therefore requires a slug. */
  get requiresSlug(): boolean {
    return this !== RestoreTargetKind.SYSTEM;
  }

  /** Resolve a raw value to a member, or `undefined` when it names no known kind. */
  static resolve(value: unknown): RestoreTargetKind | undefined {
    return RestoreTargetKind.fromValue(String(value ?? '').trim().toLowerCase()) as RestoreTargetKind | undefined;
  }
}
