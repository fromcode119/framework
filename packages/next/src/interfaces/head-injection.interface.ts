/** Type definitions for SSRRegistry */
export interface IHeadInjection {
  tag: string;
  props: Record<string, any>;
  content?: string;
}
