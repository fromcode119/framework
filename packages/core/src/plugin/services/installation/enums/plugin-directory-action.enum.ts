import { Enum } from '@fromcode119/react-class-components';

/**
 * What is about to happen to a plugin's directory, for the refusal that names it.
 *
 * Only two things ever destroy one, and the refusal has to say which was attempted: an operator told
 * "refusing to replace" looks for an update they started, one told "refusing to delete" looks for a
 * removal. It is the same guard either way — a git checkout is SOURCE and neither may touch it.
 */
export class PluginDirectoryAction extends Enum {
  static readonly REPLACE = new PluginDirectoryAction('replace');
  static readonly DELETE = new PluginDirectoryAction('delete');

  private constructor(value: string) {
    super(value);
  }
}
