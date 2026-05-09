import React from 'react';

export class SettingsContext {
  static readonly Context = React.createContext<Record<string, any>>({});
}
