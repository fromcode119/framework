import { Enum } from '@fromcode119/reactor';

/** When in the request lifecycle a plugin-registered middleware runs. */
export class MiddlewareStage extends Enum {
  static readonly PRE_AUTH = new MiddlewareStage('pre_auth');
  static readonly POST_AUTH = new MiddlewareStage('post_auth');
  static readonly PRE_ROUTING = new MiddlewareStage('pre_routing');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw manifest/config value to a member; anything unknown runs PRE_ROUTING. */
  static resolve(value: unknown): MiddlewareStage {
    if (value instanceof MiddlewareStage) return value;
    const found = MiddlewareStage.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as MiddlewareStage | undefined) ?? MiddlewareStage.PRE_ROUTING;
  }
}
