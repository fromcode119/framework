import { Context } from '@fromcode119/react-class-components';

/**
 * Reads the record on screen again and returns the values that changed; null where there is no saved
 * record to read (a new one, a settings form).
 *
 * The edit page fills it and a section's sheet wraps it, so a sheet closed afterwards keeps the new
 * values instead of putting back the ones it was opened on. A field component receives it as
 * `reloadRecord` and calls it after an action of its own has saved something the record shows.
 */
export class RecordReloadContext {
  static readonly context = new Context<(() => Promise<Record<string, any>>) | null>(null).raw;
}
