"use client";

import React from 'react';
import type { AdminRuntimeValue } from './admin-runtime-context.interfaces';

/** Holds the React context that publishes the admin runtime values to hook-free class components. */
export class AdminRuntimeContext {
  static readonly context = React.createContext<AdminRuntimeValue | null>(null);
}
