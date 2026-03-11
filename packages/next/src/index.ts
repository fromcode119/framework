import { LoadedPlugin } from '@fromcode119/core';
import type { HeadInjection, SSRContext } from './index.types';


export class SSRRegistry {
  private injections: Map<string, HeadInjection[]> = new Map();

  registerHeadInjection(pluginSlug: string, injection: HeadInjection) {
    const existing = this.injections.get(pluginSlug) || [];
    this.injections.set(pluginSlug, [...existing, injection]);
  }

  getAllInjections(): HeadInjection[] {
    return Array.from(this.injections.values()).flat();
  }
}


// Next.js specific components like a HeadInjector could go here