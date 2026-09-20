import { Enum } from '@fromcode119/react-class-components';

/**
 * What happens to one kind of record, in the only terms the operator asked about.
 *
 * The plan's own vocabulary is about IDS — `SKIP`, `REMAP`, `PRESERVE` — which answers "is this
 * import correct", a question the operator was never asking. Re-numbering is invisible to them:
 * every reference is re-pointed with it, so a shop whose orders were renumbered looks exactly like
 * one whose orders were not. What they can see is whether the records turn up and whether anything
 * about them is missing, and that is what this enum names.
 *
 * The id mechanics are not dropped — `ImportPlanRecordRow` still shows every one of them behind its
 * own Technical disclosure, which is where a mode belongs.
 */
export class ImportPlanOutcome extends Enum {
  /** Nowhere to put the rows: the plugin that owns them is not installed or not enabled here. */
  static readonly NONE = new ImportPlanOutcome('none');
  /** The records arrive, but a field, a link or some of the rows do not come with them. */
  static readonly PARTIAL = new ImportPlanOutcome('partial');
  /** Every row, every field, every link. */
  static readonly FULL = new ImportPlanOutcome('full');

  private constructor(value: string) {
    super(value);
  }
}
