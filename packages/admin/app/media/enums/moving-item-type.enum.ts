import { Enum } from '@fromcode119/reactor';

/** Whether the item being moved in the media library is a file or a folder. */
export class MovingItemType extends Enum {
  static readonly FILE = new MovingItemType('file');
  static readonly FOLDER = new MovingItemType('folder');

  private constructor(value: string) {
    super(value);
  }
}
