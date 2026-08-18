import { describe, expect, it } from 'vitest';
import { McpSchema } from '../src/mcp-schema';

describe('McpSchema', () => {
  it('builds a scalar with a description', () => {
    expect(McpSchema.string({ description: 'Page slug' }))
      .toEqual({ type: 'string', description: 'Page slug' });
  });

  it('omits an absent description rather than emitting undefined', () => {
    expect(McpSchema.number()).toEqual({ type: 'number' });
  });

  it('builds an array of a member schema', () => {
    expect(McpSchema.array(McpSchema.string()))
      .toEqual({ type: 'array', items: { type: 'string' } });
  });

  it('builds an object that rejects unknown keys', () => {
    const schema = McpSchema.object({ slug: McpSchema.string() }, ['slug']);
    expect(schema).toEqual({
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
      additionalProperties: false,
    });
  });

  it('omits `required` entirely when nothing is required', () => {
    const schema = McpSchema.object({ slug: McpSchema.string() });
    expect(schema).toEqual({
      type: 'object',
      properties: { slug: { type: 'string' } },
      additionalProperties: false,
    });
  });
});
