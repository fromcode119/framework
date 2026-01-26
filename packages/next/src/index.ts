import { LoadedPlugin } from '@fromcode/core';

export interface HeadInjection {
  tag: string;
  props: Record<string, any>;
  content?: string;
}

export interface SSRContext {
  headInjections: HeadInjection[];
}

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
