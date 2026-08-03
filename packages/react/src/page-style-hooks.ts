import React from 'react';
import type { IPageStyleContextValue } from '@react/interfaces/page-style-context-value.interface';
import { PageStyleContext } from '@react/page-style-context';

export class PageStyleHooks {
  static usePageStyle(): IPageStyleContextValue {
    return React.useContext(PageStyleContext.context);
  }
}
