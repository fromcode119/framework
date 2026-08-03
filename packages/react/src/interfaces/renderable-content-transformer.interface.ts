export interface IRenderableContentTransformer {
  name: string;
  priority: number;
  transform: (content: unknown, currentContent: unknown) => unknown;
}
