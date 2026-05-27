import React from 'react';
import type { PageStyleContextValue } from './page-style-context.interfaces';
import { PageStyleContext } from './page-style-context';

export class PageStyleHooks {
  static usePageStyle(): PageStyleContextValue {
    return React.useContext(PageStyleContext.context);
  }
}
