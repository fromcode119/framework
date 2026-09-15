import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { PersonalDataStrategy } from '@core/plugin/services/people/enums/personal-data-strategy.enum';
import { PersonalDataPolicyLayer } from '@core/plugin/services/people/enums/personal-data-policy-layer.enum';
import type { IPersonalDataChoiceMap } from '@core/plugin/services/people/interfaces/personal-data-choice-map.interface';
import type { IPersonalDataPolicyLayerState } from '@core/plugin/services/people/interfaces/personal-data-policy-layer-state.interface';
import type { IPersonalDataPolicyTarget } from '@core/plugin/services/people/interfaces/personal-data-policy-target.interface';
import type { IPersonalDataStoredChoice } from '@core/plugin/services/people/interfaces/personal-data-stored-choice.interface';
import type { IPersonalDataStrategyChoice } from '@core/plugin/services/people/interfaces/personal-data-strategy-choice.interface';

/**
 * WHICH strategy applies to a dataset, and who decided it.
 *
 * FRAMEWORK-OWNED, and that is the point. This policy used to be a privacy-plugin setting, so core
 * could not read it: `deleteMyAccount` ran on declared defaults while a DSAR for the same person on
 * the same site ran on the operator's choices. Same right, two doors, two answers. And a site with
 * no privacy plugin had erasure behaviour with no control over it at all.
 *
 * Four layers, innermost first. Each names itself, because an operator must never mistake a fallback
 * for a decision they made:
 *
 *   request   one run only — a legal hold for this subject, which leaves standing policy alone
 *   site      this site's standing policy
 *   platform  the default across every site
 *   declared  the dataset's own `defaultStrategy`, named with the plugin that declared it
 *
 * A stored choice that cannot be honoured is SKIPPED rather than silently replaced, the next layer
 * applies, and the problem is reported — silently applying `delete` to a dataset an operator marked
 * `retain` would be the worst available correction.
 */
export class PersonalDataErasurePolicy {
  private constructor(private readonly layers: IPersonalDataPolicyLayerState[]) {}

  /**
   * Read both stored layers and combine them with this run's overrides.
   *
   * The platform row is `tenant_id IS NULL`, which a tenanted connection cannot see: the policy that
   * governs `_system_meta` admits a tenant-less row only from a connection carrying the platform
   * marker. So it is read inside `withPlatformAdmin` with an explicit predicate, exactly as the
   * settings controller writes it — not added to the policy's own key list, which would expose it to
   * every tenanted read.
   */
  static async load(
    db: any,
    options?: { overrides?: IPersonalDataChoiceMap; actor?: string },
  ): Promise<PersonalDataErasurePolicy> {
    const [site, platform] = await Promise.all([
      PersonalDataErasurePolicy.readSite(db),
      PersonalDataErasurePolicy.readPlatform(db),
    ]);

    const actor = String(options?.actor ?? '').trim();
    return new PersonalDataErasurePolicy([
      {
        stored: PersonalDataErasurePolicy.asMap(options?.overrides),
        source: PersonalDataPolicyLayer.REQUEST.value,
        provenance: actor
          ? `${PersonalDataPolicyLayer.REQUEST.label} by ${actor}`
          : PersonalDataPolicyLayer.REQUEST.label,
      },
      {
        stored: site,
        source: PersonalDataPolicyLayer.SITE.value,
        provenance: PersonalDataPolicyLayer.SITE.label,
      },
      {
        stored: platform,
        source: PersonalDataPolicyLayer.PLATFORM.value,
        provenance: PersonalDataPolicyLayer.PLATFORM.label,
      },
    ]);
  }

  /** The choice for one dataset. Never throws, and never returns a strategy the dataset cannot honour. */
  resolve(target: IPersonalDataPolicyTarget): IPersonalDataStrategyChoice {
    const id = PersonalDataErasurePolicy.idOf(target);
    const problems: string[] = [];

    for (const layer of this.layers) {
      const stored = layer.stored[id];
      if (!stored) continue;

      const problem = PersonalDataErasurePolicy.problemWith(stored, target);
      if (problem) {
        problems.push(problem);
        continue;
      }

      return {
        id,
        strategy: PersonalDataStrategy.resolveValue(stored.strategy),
        reason: String(stored.reason ?? '').trim(),
        source: layer.source,
        provenance: layer.provenance,
        problem: problems.join(' '),
      };
    }

    return {
      id,
      strategy: target.defaultStrategy,
      reason: '',
      source: PersonalDataPolicyLayer.DECLARED.value,
      provenance: `${PersonalDataPolicyLayer.DECLARED.label} ${target.pluginSlug}`,
      problem: problems.join(' '),
    };
  }

  /**
   * Adopt a policy as THIS SITE's, and only if there is a site to adopt it for.
   *
   * Exists so a plugin that used to own this setting can hand its saved values over without ever
   * touching a system table — and, more importantly, without being able to get the SCOPE wrong. An
   * untenanted `meta.set` deliberately fans a value out to every site, which is right for a plugin
   * declaring one default and catastrophic here: the value being carried is one site's own decision
   * about its own data.
   *
   * Refuses rather than guesses, and refuses to overwrite: a site that already has a policy has one
   * for a reason, and a handoff must never be able to undo a choice made since.
   */
  static async adoptSitePolicy(db: any, stored: IPersonalDataChoiceMap): Promise<boolean> {
    if (!RequestContextUtils.getTenantId()) return false;
    if (!stored || Object.keys(stored).length === 0) return false;

    const key = SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES;
    const existing = await db.findOne(SystemConstants.TABLE.META, { key }).catch(() => null);
    if (String(existing?.value ?? '').trim()) return false;

    await db.insert(SystemConstants.TABLE.META, { key, value: JSON.stringify(stored) });
    return true;
  }

  static idOf(target: { pluginSlug: string; key: string }): string {
    return `${String(target.pluginSlug || '').trim()}:${String(target.key || '').trim()}`;
  }

  /**
   * Why a stored choice cannot be applied, or an empty string when it can.
   *
   * Both cases are the operator's to fix and neither is guessable, so both are stated in the words
   * that say what to do next.
   */
  private static problemWith(stored: IPersonalDataStoredChoice, target: IPersonalDataPolicyTarget): string {
    const chosen = PersonalDataStrategy.resolveValue(stored.strategy);
    if (!chosen) return '';

    if (!target.strategies.includes(chosen)) {
      return `"${chosen}" is no longer offered by ${target.pluginSlug} for ${target.label};`
        + ` the ${target.pluginSlug} default (${target.defaultStrategy}) was used instead. Choose again.`;
    }

    // A retention with no stated basis is indistinguishable from doing nothing, and it is the one
    // thing the subject is entitled to be told. Refused rather than applied silently.
    if (chosen === PersonalDataStrategy.RETAIN.value && !String(stored.reason ?? '').trim()) {
      return `${target.label} is set to retain with no stated legal basis, so it was not applied.`
        + ' Add the reason the law requires these records to be kept.';
    }

    return '';
  }

  /** This site's row, read on the request's own connection. */
  private static async readSite(db: any): Promise<IPersonalDataChoiceMap> {
    const row = await db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES })
      .catch(() => null);
    return PersonalDataErasurePolicy.parse(row?.value);
  }

  private static async readPlatform(db: any): Promise<IPersonalDataChoiceMap> {
    const table = SystemConstants.TABLE.META;
    const key = SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_DEFAULTS;

    // A deployment with no row-level security has no tenant column to qualify, and its single
    // connection already sees the only row there is.
    if (db.dialect !== 'postgres') {
      const row = await db.findOne(table, { key }).catch(() => null);
      return PersonalDataErasurePolicy.parse(row?.value);
    }

    return db.withPlatformAdmin(async () => {
      const rows = await db.queryRaw(
        `SELECT "value" FROM "${table}" WHERE "key" = $1 AND "tenant_id" IS NULL LIMIT 1`,
        [key],
      );
      return PersonalDataErasurePolicy.parse(rows?.[0]?.value);
    }).catch(() => ({}));
  }

  /** A stored blob is JSON text in `_system_meta`; anything else is treated as "nothing stored". */
  private static parse(value: unknown): IPersonalDataChoiceMap {
    if (value && typeof value === 'object') return PersonalDataErasurePolicy.asMap(value);
    const text = String(value ?? '').trim();
    if (!text) return {};
    try {
      return PersonalDataErasurePolicy.asMap(JSON.parse(text));
    } catch {
      return {};
    }
  }

  private static asMap(value: unknown): IPersonalDataChoiceMap {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as IPersonalDataChoiceMap) : {};
  }
}
