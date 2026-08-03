import { Enum } from '@fromcode119/reactor';

/**
 * Where an assistant action takes effect — a UI-ONLY badge classification derived at render time from tool
 * names (see AssistantSurfaceUtils). It is never persisted, wire-bound, or JSON-serialized, so it is a proper
 * method-bearing reactor `Enum`: each member owns its display `label` and Tailwind `badgeClass`.
 */
export class ActionSurface extends Enum {
  private static readonly NEUTRAL_BADGE =
  'border-slate-300/90 bg-slate-100/90 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/65 dark:text-slate-200';
  private static readonly STRONG_BADGE =
  'border-slate-400/90 bg-slate-200/90 text-slate-800 dark:border-slate-500/70 dark:bg-slate-700/70 dark:text-slate-100';

  static readonly FRONTEND = new ActionSurface('frontend', 'Frontend', ActionSurface.NEUTRAL_BADGE);
  static readonly BACKEND = new ActionSurface('backend', 'Backend', ActionSurface.STRONG_BADGE);
  static readonly MIXED = new ActionSurface('mixed', 'Mixed', ActionSurface.NEUTRAL_BADGE);

  private constructor(value: string, readonly label: string, readonly badgeClass: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to FRONTEND. */
  static resolve(value: unknown): ActionSurface {
    if (value instanceof ActionSurface) return value;
    const found = ActionSurface.fromValue(String(value ?? '').trim());
    return (found as ActionSurface | undefined) ?? ActionSurface.FRONTEND;
  }
}
