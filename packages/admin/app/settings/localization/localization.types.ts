export type LocaleItem = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
};

export type LocaleUrlStrategy = 'query' | 'path' | 'none';
