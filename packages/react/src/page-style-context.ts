import React from 'react';
import type { PageStyleContextValue } from './page-style-context.interfaces';

export class PageStyleContext {
  static readonly context = React.createContext<PageStyleContextValue>({
    styleVariant: 'default',
    styleConfig: null,
  });
}
