import { Enum } from '@fromcode119/react-class-components';

/**
 * What a build source produces. Values arrive as RAW strings from the database and from HTTP
 * payloads, so every boundary hydrates through {@link BuildSourceType.resolve} — an Enum member
 * compared against a bare string is always false, which compiles silently.
 *
 * `Enum.toJSON()` emits the bare value, so the stored/wire shape is unchanged.
 */
export class BuildSourceType extends Enum {
  static readonly PLUGIN = new BuildSourceType('plugin');
  static readonly THEME = new BuildSourceType('theme');
  static readonly APPEARANCE = new BuildSourceType('appearance');
  static readonly CORE = new BuildSourceType('core');

  private constructor(value: string) {
    super(value);
  }

  /** Hydrate an untrusted value; anything unrecognised is a plugin, matching the previous fallbacks. */
  static resolve(value: unknown): BuildSourceType {
    if (value instanceof BuildSourceType) return value;
    return (BuildSourceType.fromValue(String(value ?? '').trim()) as BuildSourceType | undefined)
      ?? BuildSourceType.PLUGIN;
  }
}
