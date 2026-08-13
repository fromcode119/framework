import { AssistantVocabularyRole } from '@core/services/enums/assistant-vocabulary-role.enum';

/**
 * Registry of the words the admin assistant recognises as naming data.
 *
 * The assistant must decide whether a question is asking for records before it can answer it, and that
 * decision needs vocabulary. Vocabulary belongs to whoever owns the records: the framework does not know
 * what its installed plugins keep, and a built-in list makes the assistant fluent in domains that are not
 * installed and mute in the ones that are. So the framework owns the mechanism and none of the words.
 *
 * Terms are registered by ROLE, not as one flat list, because the matchers are not interchangeable. A
 * question naming a countable record ("how many orders") is a different signal from one naming a measure
 * ("what is the revenue"), and flattening the two makes the classifier answer "is this about a specific
 * record?" with yes for "what is the revenue". That is not hypothetical — it is what a single shared list
 * did when this was first attempted, caught by replaying the classifier over a recorded corpus.
 *
 * Registration is idempotent per (role, key), so a plugin re-init replaces rather than stacks.
 */
export class AssistantVocabularyRegistryService {
  /** role -> plugin key -> terms. */
  private readonly byRole = new Map<string, Map<string, string[]>>();

  register(key: string, role: AssistantVocabularyRole, terms: readonly string[]): void {
    if (!key || !role || !Array.isArray(terms)) return;

    const cleaned = [...new Set(
      terms.map((term) => String(term ?? '').trim().toLowerCase()).filter((term) => term.length > 0),
    )];

    const forRole = this.byRole.get(role.value) ?? new Map<string, string[]>();
    if (cleaned.length) forRole.set(key, cleaned);
    else forRole.delete(key);
    this.byRole.set(role.value, forRole);
  }

  /** Drop every role's contribution from one plugin. */
  unregister(key: string): void {
    for (const forRole of this.byRole.values()) forRole.delete(key);
  }

  clear(): void {
    this.byRole.clear();
  }

  /** Every term registered under a role, de-duplicated across plugins. */
  terms(role: AssistantVocabularyRole): string[] {
    const forRole = this.byRole.get(role?.value);
    if (!forRole) return [];
    return [...new Set([...forRole.values()].flat())].sort();
  }

  /**
   * The role's terms as one regex alternation, or `null` when the role has nothing registered.
   *
   * `null` rather than an empty string: an empty alternation compiles to a group matching the empty
   * string, which would make every message match every matcher.
   */
  alternation(...roles: AssistantVocabularyRole[]): string | null {
    const terms = [...new Set(roles.flatMap((role) => this.terms(role)))].sort();
    if (!terms.length) return null;
    return terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  }
}
