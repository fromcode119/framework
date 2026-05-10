import React from 'react';
import type { SlotComponent } from '../context.interfaces';

export class SlotsContext {
  static readonly Context = React.createContext<Record<string, SlotComponent[]>>({});
}
