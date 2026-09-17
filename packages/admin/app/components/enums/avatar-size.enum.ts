import { Enum } from '@fromcode119/react-class-components';

/** The two sizes the sidebar's account avatar is drawn at — collapsed rail and expanded card. */
export class AvatarSize extends Enum {
  static readonly SMALL = new AvatarSize('sm');
  static readonly MEDIUM = new AvatarSize('md');

  private constructor(value: string) {
    super(value);
  }
}
