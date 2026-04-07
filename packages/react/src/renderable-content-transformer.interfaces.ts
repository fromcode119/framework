export interface RenderableContentTransformer {
  name: string;
  priority: number;
  transform: (content: unknown, currentContent: unknown) => unknown;
}

export interface RenderableContentTransformerMetadata {
  name: string;
  priority: number;
}