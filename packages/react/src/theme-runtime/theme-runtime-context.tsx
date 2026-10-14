import { Context } from '@fromcode119/react-class-components';
import type { IThemeRuntimeValue } from '@react/theme-runtime/interfaces/theme-runtime-value.interface';

/** The React context that carries the theme runtime to class components. */
export class ThemeRuntimeContext {
  static readonly Context = new Context<IThemeRuntimeValue | null>(null);
}
