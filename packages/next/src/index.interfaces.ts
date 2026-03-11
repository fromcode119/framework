/** Type definitions for SSRRegistry */

export interface HeadInjection {
  tag: string;
  props: Record<string, any>;
  content?: string;
}

export interface SSRContext {
  headInjections: HeadInjection[];
}
