import React from 'react';

export interface TranslationContextValue {
  t: (key: string, params?: Record<string, any>, defaultValue?: string) => string;
  locale: string;
  setLocale: (locale: string) => void;
}

const defaultValue: TranslationContextValue = {
  t: (key) => key,
  locale: 'en',
  setLocale: () => {},
};

export class TranslationContext {
  static readonly Context = React.createContext<TranslationContextValue>(defaultValue);
}
