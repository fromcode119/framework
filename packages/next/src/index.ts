
import type { IHeadInjection } from '@nextjs/interfaces/head-injection.interface';

export class SSRRegistry {
  private injections: Map<string, IHeadInjection[]> = new Map();

  registerHeadInjection(pluginSlug: string, injection: IHeadInjection) {
    const existing = this.injections.get(pluginSlug) || [];
    this.injections.set(pluginSlug, [...existing, injection]);
  }

  getAllInjections(): IHeadInjection[] {
    return Array.from(this.injections.values()).flat();
  }
}

// Next.js specific components like a HeadInjector could go here