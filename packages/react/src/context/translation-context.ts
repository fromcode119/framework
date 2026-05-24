import React from 'react';
import type { TranslationContextValue } from './translation-context.interfaces';

const defaultValue: TranslationContextValue = {
  t: (key) => key,
  locale: 'en',
  setLocale: () => {},
};

export class TranslationContext {
  static readonly Context = React.createContext<TranslationContextValue>(defaultValue);
}
