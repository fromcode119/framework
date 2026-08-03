import { Enum } from '@fromcode119/reactor';

/** Why a plugin dependency is unsatisfied. */
export class DependencyIssueType extends Enum {
  static readonly MISSING = new DependencyIssueType('missing');
  static readonly INCOMPATIBLE = new DependencyIssueType('incompatible');
  static readonly INACTIVE = new DependencyIssueType('inactive');

  private constructor(value: string) {
    super(value);
  }
}
