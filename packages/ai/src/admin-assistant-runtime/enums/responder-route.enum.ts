import { Enum } from '@fromcode119/reactor';

/** Which responder path handled the turn. */
export class ResponderRoute extends Enum {
  static readonly QUICK = new ResponderRoute('quick');
  static readonly MODEL = new ResponderRoute('model');
  static readonly TOOL_MODEL = new ResponderRoute('tool_model');
  static readonly FALLBACK = new ResponderRoute('fallback');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to QUICK. */
  static resolve(value: unknown): ResponderRoute {
    if (value instanceof ResponderRoute) return value;
    const found = ResponderRoute.fromValue(String(value ?? '').trim());
    return (found as ResponderRoute | undefined) ?? ResponderRoute.QUICK;
  }
}
