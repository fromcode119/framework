import type { IRenderableContentTransformer } from '@react/interfaces/renderable-content-transformer.interface';
import type { IRenderableContentTransformerMetadata } from '@react/interfaces/renderable-content-transformer-metadata.interface';

export class RenderableContentTransformerRegistry {
  private static readonly transformers = new Map<string, IRenderableContentTransformer>();

  static register(
    name: string,
    transform: (content: unknown, currentContent: unknown) => unknown,
    priority = 10,
  ): void {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
      throw new Error('Renderable content transformer name is required.');
    }

    RenderableContentTransformerRegistry.transformers.set(normalizedName, {
      name: normalizedName,
      priority: Number.isFinite(priority) ? priority : 10,
      transform,
    });
  }

  static has(name: string): boolean {
    const normalizedName = String(name || '').trim();
    return RenderableContentTransformerRegistry.transformers.has(normalizedName);
  }

  static transform(content: unknown, currentContent: unknown): unknown {
    let nextContent = currentContent;

    for (const transformer of RenderableContentTransformerRegistry.getAll()) {
      const transformed = transformer.transform(content, nextContent);
      if (transformed !== undefined) {
        nextContent = transformed;
      }
    }

    return nextContent;
  }

  static clear(): void {
    RenderableContentTransformerRegistry.transformers.clear();
  }

  static getMetadata(): IRenderableContentTransformerMetadata[] {
    return RenderableContentTransformerRegistry.getAll().map((transformer) => ({
      name: transformer.name,
      priority: transformer.priority,
    }));
  }

  private static getAll(): IRenderableContentTransformer[] {
    return Array.from(RenderableContentTransformerRegistry.transformers.values())
      .sort((left, right) => left.priority - right.priority);
  }
}