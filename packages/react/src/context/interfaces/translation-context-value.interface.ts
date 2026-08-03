export interface ITranslationContextValue {
  t: (key: string, params?: Record<string, any>, defaultValue?: string) => string;
  locale: string;
  setLocale: (locale: string) => void;
}
