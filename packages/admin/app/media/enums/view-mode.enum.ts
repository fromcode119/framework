import { Enum } from '@fromcode119/reactor';

/** How the media library lays out items: a grid of thumbnails or a list. */
export class ViewMode extends Enum {
  static readonly GRID = new ViewMode('grid');
  static readonly LIST = new ViewMode('list');

  private constructor(value: string) {
    super(value);
  }
}
