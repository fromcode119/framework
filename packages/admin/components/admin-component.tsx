"use client";

import React from 'react';
import { AdminRuntimeContext } from './admin-runtime-context';
import type { AdminRuntimeValue } from './admin-runtime-context.interfaces';
import type { ThemeContextType } from '@/components/theme-context.interfaces';

/**
 * Base class for hook-free admin components. Reads {@link AdminRuntimeContext} as the class
 * contextType so subclasses access runtime values via `this.runtime` without calling hooks.
 */
export abstract class AdminComponent<P = Record<string, unknown>, S = Record<string, unknown>>
  extends React.Component<P, S> {
  static contextType = AdminRuntimeContext.context;
  declare context: AdminRuntimeValue;

  protected get runtime(): AdminRuntimeValue {
    return this.context;
  }

  protected get theme(): ThemeContextType['theme'] {
    return this.context?.theme;
  }

  protected get collections(): any[] {
    return this.context?.collections ?? [];
  }

  /** App Router navigation — replaces `useRouter()` for hook-free classes. */
  protected get router(): AdminRuntimeValue['router'] {
    return this.context?.router;
  }

  /** Current pathname — replaces `usePathname()` for hook-free classes. */
  protected get pathname(): string {
    return this.context?.pathname ?? '';
  }

  /** Auth context — replaces `AuthHooks.useAuth()` for hook-free classes. */
  protected get auth(): AdminRuntimeValue['auth'] {
    return this.context?.auth;
  }
}
