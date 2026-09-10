import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * The three kinds of extension this builder knows how to build.
 *
 * `/lang` is the React-free entry of react-class-components — importing the package root would pull
 * React into a Node-only build tool.
 *
 * `value`, `values()`, `fromValue()` and `has()` come from the base and are NOT redeclared here:
 * shadowing `fromValue` with throwing semantics would give two methods the same name and different
 * contracts. The throwing accessor is `require()`.
 */
export class ExtensionKind extends Enum {
  static readonly PLUGIN = new ExtensionKind('plugin', 'plugins');
  static readonly THEME = new ExtensionKind('theme', 'themes');
  static readonly APPEARANCE = new ExtensionKind('appearance', 'appearance');

  private constructor(value: string, private readonly directory: string) {
    super(value);
  }

  /** The root directory holding extensions of this kind. Singular for appearances, by convention. */
  directoryName(): string {
    return this.directory;
  }

  /** Refuses an unknown value rather than guessing — a wrong kind builds the wrong thing silently. */
  static require(value: unknown): ExtensionKind {
    const found = ExtensionKind.fromValue(String(value));
    if (!found) throw new Error(`Unknown extension kind: "${String(value)}"`);
    return found;
  }
}
