import { 
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLString, 
  GraphQLInt, 
  GraphQLBoolean, 
  GraphQLList, 
  GraphQLNonNull, 
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLFieldConfig,
  GraphQLResolveInfo
} from 'graphql';
import { Collection, Field, FieldType } from '@fromcode119/core';
import { PluginManager } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';

export class GraphQLService {
  private typeCache: Map<string, GraphQLObjectType> = new Map();
  private inputTypeCache: Map<string, GraphQLInputObjectType> = new Map();

  constructor(private manager: PluginManager, private restController: RESTController) {}

  public generateSchema(): GraphQLSchema {
    this.typeCache.clear();
    this.inputTypeCache.clear();
    
    const collections = this.manager.getCollections();
    
    const queryFields: Record<string, any> = {};
    const mutationFields: Record<string, any> = {};

    for (const collection of collections) {
      if (collection.admin?.hidden === true && !collection.system) continue;

      const type = this.getOrCreateType(collection);
      const slug = collection.shortSlug || collection.slug;
      const capitalizedSlug = slug.charAt(0).toUpperCase() + slug.slice(1);

      // Query: single
      queryFields[slug] = {
        type,
        args: {
          id: { type: new GraphQLNonNull(GraphQLInt) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, params: { id: args.id } };
          return this.restController.findOne(collection, req);
        }
      };

      // Query: list
      queryFields[`all${capitalizedSlug}`] = {
        type: new GraphQLList(type),
        args: {
          page: { type: GraphQLInt },
          limit: { type: GraphQLInt },
          search: { type: GraphQLString },
          sort: { type: GraphQLString }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { 
            ...context.req, 
            query: { 
              page: args.page, 
              limit: args.limit, 
              search: args.search,
              sort: args.sort
            } 
          };
          const result: any = await this.restController.find(collection, req);
          return result.docs;
        }
      };

      // Mutations
      const inputType = this.getOrCreateInputType(collection);

      mutationFields[`create${capitalizedSlug}`] = {
        type,
        args: {
          data: { type: new GraphQLNonNull(inputType) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, body: args.data };
          return this.restController.create(collection, req);
        }
      };

      mutationFields[`update${capitalizedSlug}`] = {
        type,
        args: {
          id: { type: new GraphQLNonNull(GraphQLInt) },
          data: { type: new GraphQLNonNull(inputType) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, params: { id: args.id }, body: args.data };
          return this.restController.update(collection, req);
        }
      };

      mutationFields[`delete${capitalizedSlug}`] = {
        type: GraphQLBoolean,
        args: {
          id: { type: new GraphQLNonNull(GraphQLInt) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, params: { id: args.id } };
          await this.restController.delete(collection, req);
          return true;
        }
      };

      mutationFields[`bulkCreate${capitalizedSlug}`] = {
        type: new GraphQLList(type),
        args: {
          data: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(inputType))) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, body: args.data };
          return this.restController.bulkCreate(collection, req);
        }
      };

      mutationFields[`bulkUpdate${capitalizedSlug}`] = {
        type: new GraphQLList(type),
        args: {
          ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt))) },
          data: { type: new GraphQLNonNull(inputType) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, body: { ids: args.ids, data: args.data } };
          return this.restController.bulkUpdate(collection, req);
        }
      };

      mutationFields[`bulkDelete${capitalizedSlug}`] = {
        type: GraphQLBoolean,
        args: {
            ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt))) }
        },
        resolve: async (parent: any, args: any, context: any) => {
          const req = { ...context.req, body: { ids: args.ids } };
          await this.restController.bulkDelete(collection, req);
          return true;
        }
      };
    }

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: queryFields
      }),
      mutation: Object.keys(mutationFields).length > 0 ? new GraphQLObjectType({
        name: 'Mutation',
        fields: mutationFields
      }) : undefined
    });
  }

  private getOrCreateType(collection: Collection): GraphQLObjectType {
    const typeName = (collection.shortSlug || collection.slug).charAt(0).toUpperCase() + (collection.shortSlug || collection.slug).slice(1);
    
    if (this.typeCache.has(typeName)) {
      return this.typeCache.get(typeName)!;
    }

    const type = new GraphQLObjectType({
      name: typeName,
      fields: () => {
        const fields: Record<string, any> = {
          id: { type: GraphQLInt }
        };

        for (const field of collection.fields) {
          if (field.name === 'id') continue;
          fields[field.name] = { type: this.mapFieldToGraphQLType(field) };
        }

        // Standard timestamps
        if (collection.timestamps !== false) {
          fields.createdAt = { type: GraphQLString };
          fields.updatedAt = { type: GraphQLString };
        }

        return fields;
      }
    });

    this.typeCache.set(typeName, type);
    return type;
  }

  private getOrCreateInputType(collection: Collection): GraphQLInputObjectType {
    const typeName = (collection.shortSlug || collection.slug).charAt(0).toUpperCase() + (collection.shortSlug || collection.slug).slice(1) + 'Input';
    
    if (this.inputTypeCache.has(typeName)) {
      return this.inputTypeCache.get(typeName)!;
    }

    const type = new GraphQLInputObjectType({
      name: typeName,
      fields: () => {
        const fields: Record<string, any> = {};

        for (const field of collection.fields) {
          if (field.name === 'id') continue;
          fields[field.name] = { type: this.mapFieldToGraphQLType(field, true) };
        }

        return fields;
      }
    });

    this.inputTypeCache.set(typeName, type);
    return type;
  }

  private mapFieldToGraphQLType(field: Field, isInput: boolean = false): any {
    let type: any;

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'date':
      case 'datetime':
      case 'richText':
      case 'select':
      case 'color':
      case 'code':
        type = GraphQLString;
        break;
      case 'number':
        type = GraphQLInt;
        break;
      case 'boolean':
        type = GraphQLBoolean;
        break;
      case 'json':
      case 'array':
        type = GraphQLString; // Simplified for now
        break;
      case 'relationship':
      case 'upload':
        type = field.hasMany ? new GraphQLList(GraphQLInt) : GraphQLInt;
        break;
      default:
        type = GraphQLString;
    }

    if (field.required && isInput) {
      return new GraphQLNonNull(type);
    }

    return type;
  }
}
