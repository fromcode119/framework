import { Enum } from '@fromcode119/react-class-components';

/**
 * The job a registered word does when the assistant classifies a question.
 *
 * Roles exist because the matchers are not interchangeable — "how many orders" and "what is the revenue"
 * are different questions, and a word that makes one of them a data question does not make the other a
 * question about a specific record.
 */
export class AssistantVocabularyRole extends Enum {
  /** A quantity that gets summed or averaged — the subject of "what is the …". */
  static readonly MEASURE = new AssistantVocabularyRole('measure');

  /** The narrower revenue-shaped subset of MEASURE, used when ranking a numeric result path. */
  static readonly REVENUE = new AssistantVocabularyRole('revenue');

  /** A record you can count — the subject of "how many …". */
  static readonly COUNTABLE = new AssistantVocabularyRole('countable');

  /** A record you can ask for details of — "what was the status of the last one". */
  static readonly ENTITY = new AssistantVocabularyRole('entity');

  /** A field ON a record, used to spot "what is the <field> of …". */
  static readonly ATTRIBUTE = new AssistantVocabularyRole('attribute');

  /** Extra nouns that make a question metric-shaped without being measures themselves. */
  static readonly SUBJECT = new AssistantVocabularyRole('subject');

  /** Terms whose absence from a question should demote a matching result path. */
  static readonly DEMOTE_WHEN_ABSENT = new AssistantVocabularyRole('demoteWhenAbsent');

  private constructor(value: string) {
    super(value);
  }
}
