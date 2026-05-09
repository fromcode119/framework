import React from 'react';
import type { MenuItem } from '../context.interfaces';

export class MenuContext {
  static readonly Context = React.createContext<MenuItem[]>([]);
}
