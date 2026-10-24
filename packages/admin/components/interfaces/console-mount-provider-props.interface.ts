import type React from 'react';

export interface IConsoleMountProviderProps {
  /** The sanitized mount the request carried (`ConsoleMountConstants.HEADER`); `''` when not mounted. */
  mount: string;
  children: React.ReactNode;
}
