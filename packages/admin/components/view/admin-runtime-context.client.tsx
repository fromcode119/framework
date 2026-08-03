import React from 'react';
import type { IAdminRuntimeValue } from '@/components/interfaces/admin-runtime-value.interface';

/** Holds the React context that publishes the admin runtime values to hook-free class components. */
export class AdminRuntimeContext {
  static readonly context = React.createContext<IAdminRuntimeValue | null>(null);
}
