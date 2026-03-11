import { type Collection } from '@fromcode119/core';
import { ApiConfig } from './config/api-config';

export class SwaggerGenerator {
  static generate(collections: Collection[]) {
  const paths: any = {};
  const components: any = {
    schemas: {}
  };

  const collectionsBase = ApiConfig.getInstance().legacyRoutes.collections.BASE;

  for (const collection of collections) {
    const slug = collection.slug;
    const properties: any = {
      id: { type: 'string' }
    };

    const required = collection.fields
      .filter(f => f.required && !f.admin?.hidden)
      .map(f => f.name);

    for (const field of collection.fields) {
      if (field.admin?.hidden) continue;

      properties[field.name] = {
        type: SwaggerGenerator.mapTypeToOpenAPI(field.type),
        description: field.label
      };
    }

    components.schemas[slug] = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };

    paths[`${collectionsBase}/${slug}`] = {
      get: {
        summary: `List ${slug}`,
        responses: {
          200: {
            description: `List of ${slug}`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    docs: { type: 'array', items: { $ref: `#/components/schemas/${slug}` } },
                    totalDocs: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: `Create ${slug}`,
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${slug}` }
            }
          }
        },
        responses: {
          201: {
            description: `Created ${slug}`,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${slug}` }
              }
            }
          }
        }
      }
    };

    paths[`${collectionsBase}/${slug}/{id}`] = {
      get: {
        summary: `Get ${slug} by ID`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${slug}` } } }
          }
        }
      },
      put: {
        summary: `Update ${slug} by ID`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${slug}` } } }
        },
        responses: {
          200: {
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${slug}` } } }
          }
        }
      },
      delete: {
        summary: `Delete ${slug} by ID`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } }
          }
        }
      }
    };
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'Fromcode Framework API',
      version: '1.0.0'
    },
    paths,
    components
  };
}

  private static mapTypeToOpenAPI(type: string): string {
    switch (type) {
      case 'number': return 'integer';
      case 'boolean': return 'boolean';
      case 'date': return 'string';
      case 'json': return 'object';
      default: return 'string';
    }
  }
}