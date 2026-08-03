import { Enum } from '@fromcode119/reactor';

/** Language for a code-editor field. */
export class CodeLanguage extends Enum {
  static readonly JAVASCRIPT = new CodeLanguage('javascript');
  static readonly CSS = new CodeLanguage('css');
  static readonly HTML = new CodeLanguage('html');
  static readonly JSON = new CodeLanguage('json');
  static readonly TYPESCRIPT = new CodeLanguage('typescript');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to JAVASCRIPT. */
  static resolve(value: unknown): CodeLanguage {
    if (value instanceof CodeLanguage) return value;
    const found = CodeLanguage.fromValue(String(value ?? '').trim());
    return (found as CodeLanguage | undefined) ?? CodeLanguage.JAVASCRIPT;
  }
}
