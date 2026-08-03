import { Enum } from '@fromcode119/reactor';

/**
 * The lifecycle state of an action batch, as a method-bearing enum. Each member carries its gating rules as
 * readonly data (the way `Status('draft', 'grey')` carries `color`), so callers read `state.allowsPreview`
 * instead of scattering `state === BatchState.STAGED` string checks. Hydrate a DTO string with `resolve()`; render its
 * wire value with `.value` (an Enum instance is not a valid React child).
 */
export class BatchState extends Enum {
  //                                        value         isLocked  allowsPreview  allowsApply
  static readonly STAGED    = new BatchState('staged',    false,    true,          false);
  static readonly PREVIEWED = new BatchState('previewed', false,    false,         true);
  static readonly APPLIED   = new BatchState('applied',   true,     false,         false);
  static readonly STALE     = new BatchState('stale',     true,     false,         false);

  private constructor(
    value: string,
    readonly isLocked: boolean,
    readonly allowsPreview: boolean,
    readonly allowsApply: boolean,
  ) {
    super(value);
  }

  /** Hydrate a wire string (defaulting to STAGED for unknown/empty). */
  static resolve(value: string | undefined | null): BatchState {
    return BatchState.fromValue(String(value || 'staged')) ?? BatchState.STAGED;
  }
}
