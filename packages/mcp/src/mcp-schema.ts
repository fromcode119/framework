/**
 * Builds plain JSON Schema objects for tool inputs.
 *
 * Returns data, not a wrapper: what comes out is handed straight to MCP clients, so there is nothing
 * to serialise and nothing to unwrap. An absent description is OMITTED rather than emitted as
 * `undefined`, because `{ description: undefined }` serialises to a key the client then has to ignore.
 */
export class McpSchema {
  private static scalar(type: string, options?: { description?: string }): Record<string, unknown> {
    const schema: Record<string, unknown> = { type };
    if (options?.description) schema.description = options.description;
    return schema;
  }

  static string(options?: { description?: string }): Record<string, unknown> {
    return McpSchema.scalar('string', options);
  }

  static number(options?: { description?: string }): Record<string, unknown> {
    return McpSchema.scalar('number', options);
  }

  static boolean(options?: { description?: string }): Record<string, unknown> {
    return McpSchema.scalar('boolean', options);
  }

  static array(items: Record<string, unknown>, options?: { description?: string }): Record<string, unknown> {
    const schema = McpSchema.scalar('array', options);
    schema.items = items;
    return schema;
  }

  /** `additionalProperties: false` always: an unknown argument is a caller bug, not something to ignore. */
  static object(
    properties: Record<string, Record<string, unknown>>,
    required?: string[],
  ): Record<string, unknown> {
    const schema: Record<string, unknown> = { type: 'object', properties };
    if (required?.length) schema.required = [...required];
    schema.additionalProperties = false;
    return schema;
  }
}
