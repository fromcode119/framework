import { Enum } from '@fromcode119/reactor';

/**
 * Converts reactor `Enum` members into their primitive string value anywhere inside a `context.db.*`
 * argument, so plugin code can pass an Enum member straight into a payload or a `where` clause.
 *
 * WHY THIS EXISTS — the failure it prevents:
 * A plain TypeScript string enum member IS its string, so `db.update(t, { id }, { status: Status.Paid })`
 * binds `'paid'`. A reactor `Enum` member is an OBJECT. `toJSON()` covers `JSON.stringify`, but SQL
 * parameter binding does NOT stringify — the driver receives an object and either throws or writes
 * something meaningless into the column. The columns in question are money-bearing
 * (`fcp_ecommerce_orders.status`, `fcp_mlm_commissions.status`).
 *
 * Worse, `tsc` cannot find those call sites: an object is assignable to a loose payload type, so the
 * only diagnostics it emits are for *comparisons*, never for writes. That makes a per-call-site
 * `.value` discipline unenforceable across ~1,500 references. Coercing once, centrally, at the single
 * point every plugin DB call already passes through, is the only version of this that can be relied on.
 *
 * Structural sharing: a container is rebuilt ONLY when it actually contains an Enum somewhere beneath
 * it. A payload with no Enum members is returned by identity, so the common case allocates nothing.
 */
export class EnumValueCoercion {
  /**
   * Is `candidate` a reactor Enum member?
   *
   * `instanceof` is checked first and is the accurate answer whenever core and the calling plugin
   * resolve the same reactor module. It cannot be the ONLY check: reactor ships dual ESM+CJS, so a
   * plugin loaded through the CJS build and core loaded through the ESM build hold two different
   * `Enum` class objects and `instanceof` silently returns false — which here would mean an object
   * reaching a SQL parameter. The structural fallback closes that gap.
   *
   * The fallback is deliberately narrow: `toJSON()` must return the exact same string as `.value`.
   * `Enum` guarantees that; an arbitrary payload object carrying an unrelated `value` field does not.
   */
  private static isEnumMember(candidate: unknown): candidate is Enum {
    if (candidate instanceof Enum) return true;
    if (candidate === null || typeof candidate !== 'object') return false;
    const shape = candidate as { value?: unknown; toJSON?: unknown };
    if (typeof shape.value !== 'string' || typeof shape.toJSON !== 'function') return false;
    return (shape as { toJSON(): unknown }).toJSON() === shape.value;
  }

  /**
   * Structures that must be handed to the driver untouched. Dates and Buffers are legitimate bound
   * parameters, and drizzle's SQL fragment objects carry internal state that must not be rebuilt.
   */
  private static isOpaque(value: object): boolean {
    return value instanceof Date
      || value instanceof RegExp
      || ArrayBuffer.isView(value)
      || value instanceof ArrayBuffer
      || value instanceof Map
      || value instanceof Set;
  }

  /** Recursively replace every Enum member with its `.value`, preserving identity where nothing changed. */
  static coerce<T>(value: T): T {
    if (EnumValueCoercion.isEnumMember(value)) return value.value as unknown as T;
    if (value === null || typeof value !== 'object') return value;
    if (EnumValueCoercion.isOpaque(value as object)) return value;

    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((entry) => {
        const coerced = EnumValueCoercion.coerce(entry);
        if (coerced !== entry) changed = true;
        return coerced;
      });
      return (changed ? next : value) as unknown as T;
    }

    // Only plain-ish objects are walked. A class instance from a plugin (a drizzle fragment, an entity)
    // is left alone: rebuilding it as a bare object would strip its prototype and its behaviour.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const coerced = EnumValueCoercion.coerce(entry);
      if (coerced !== entry) changed = true;
      next[key] = coerced;
    }
    return (changed ? next : value) as unknown as T;
  }

  /** Coerce a whole `context.db.*` argument list. */
  static coerceArguments(args: unknown[]): unknown[] {
    let changed = false;
    const next = args.map((arg) => {
      const coerced = EnumValueCoercion.coerce(arg);
      if (coerced !== arg) changed = true;
      return coerced;
    });
    return changed ? next : args;
  }
}
