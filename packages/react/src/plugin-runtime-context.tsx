"use client";

import React from 'react';
import type { PluginRuntimeValue } from './plugin-runtime-context.interfaces';

/** Holds the React context publishing plugin runtime values to hook-free plugin class components. */
export class PluginRuntimeContext {
  static readonly context = React.createContext<PluginRuntimeValue | null>(null);
}
