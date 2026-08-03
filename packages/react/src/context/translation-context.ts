import { Context as ReactorContext } from '@fromcode119/reactor';
import type { ITranslationContextValue } from '@react/context/interfaces/translation-context-value.interface';

export class TranslationContext {
  private static readonly defaultValue: ITranslationContextValue = {
    t: (key: string) => key,
    locale: 'en',
    setLocale: () => {},
  };
  static readonly Context = new ReactorContext<ITranslationContextValue>(TranslationContext.defaultValue).raw;
}
