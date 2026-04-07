import { afterEach, describe, expect, it } from 'vitest';
import { ContentRenderingUtils } from '../lib/content-rendering-utils';
import { RenderableContentTransformerRegistry } from '../../react/src/renderable-content-transformer-registry';

describe('ContentRenderingUtils', () => {
  afterEach(() => {
    RenderableContentTransformerRegistry.clear();
  });

  it('returns direct content without invoking transformers', () => {
    RenderableContentTransformerRegistry.register('test.transformer', () => {
      throw new Error('transformer should not run for direct content');
    });

    expect(ContentRenderingUtils.buildRenderableContent({ content: '<p>Hello</p>' })).toBe('<p>Hello</p>');
  });

  it('delegates missing content adaptation to registered transformers', () => {
    RenderableContentTransformerRegistry.register('test.transformer', (content, currentContent) => {
      if (currentContent) {
        return currentContent;
      }

      return [{ id: 'generated-block', type: 'test-block', data: { slug: (content as { slug?: string })?.slug || '' } }];
    });

    expect(ContentRenderingUtils.buildRenderableContent({ slug: 'sample-page' })).toEqual([
      { id: 'generated-block', type: 'test-block', data: { slug: 'sample-page' } },
    ]);
  });
});