import { Enum } from '@fromcode119/react-class-components';

/** Why an archive cascade left a follower collection alone. */
export class ArchiveCascadeSkip extends Enum {
  /** The operator may not update that collection, so the leader's permission is not used to write it. */
  static readonly PERMISSION = new ArchiveCascadeSkip('permission');
  /** The write failed — typically a site whose plugin does not have that table. */
  static readonly ERROR = new ArchiveCascadeSkip('error');

  private constructor(value: string) {
    super(value);
  }
}
