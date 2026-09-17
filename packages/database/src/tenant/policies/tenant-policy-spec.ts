import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';

/**
 * A policy the generic `tenant_id = current_tenant` rule cannot express.
 *
 * The CALLER declares WHAT the rule means — "media may be shared", "these settings keys are
 * deployment truths", "this table is a journal" — and the dialect renders HOW. That split is the
 * whole point: the keys and table names are core knowledge (`SystemSettingRegistry`,
 * `SystemConstants`), while `CREATE POLICY ... USING ... WITH CHECK` is Postgres knowledge. Neither
 * side has to know the other's half.
 *
 * WHY CLASSES AND A RENDERER, NOT A UNION. This was `type ITenantPolicySpec = A | B | C | D | E`,
 * and a union was the one shape claimed to have no OOP form — the reason it sat on the guard's
 * exemption list while the guard reported zero. It has one. Each kind is a class that knows its own
 * fields, and `render` hands itself to whichever renderer the dialect supplies. The exhaustiveness
 * the union bought is not lost and does not become a runtime `instanceof` chain either: a new policy
 * class cannot compile until `ITenantPolicyRenderer` grows the method for it, and no renderer can
 * compile until it implements that method. A missed kind is a build error, not a table that silently
 * ships with no policy on it.
 */
export abstract class TenantPolicySpec {
  /** The table this policy governs. Every kind has one; nothing else is shared between them. */
  constructor(readonly table: string) {}

  /** Hand this spec to a renderer, which answers in whatever form it produces (SQL, here). */
  abstract render<T>(renderer: ITenantPolicyRenderer<T>): T;
}
