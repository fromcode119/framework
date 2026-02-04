import { GraphQLService } from '../src/services/GraphQLService';
import { graphql } from 'graphql';

describe('GraphQLService', () => {
  let service: GraphQLService;
  let mockManager: any;
  let mockRestController: any;

  beforeEach(() => {
    mockManager = {
      getCollections: jest.fn().mockReturnValue([
        {
          slug: 'posts',
          shortSlug: 'posts',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'content', type: 'textarea' }
          ]
        }
      ])
    };

    mockRestController = {
      findInternal: jest.fn().mockResolvedValue({ docs: [{ id: 1, title: 'GraphQL Post' }], totalDocs: 1 }),
      findOneInternal: jest.fn().mockResolvedValue({ id: 1, title: 'GraphQL Post' }),
      createInternal: jest.fn().mockResolvedValue({ id: 2, title: 'New Post' })
    };

    service = new GraphQLService(mockManager, mockRestController);
  });

  it('generates a schema with queries and mutations', async () => {
    const schema = service.generateSchema();
    expect(schema).toBeDefined();
    
    // Test a query
    const query = `
      query {
        posts(id: 1) {
          id
          title
        }
      }
    `;

    const result = await graphql({
      schema,
      source: query,
      contextValue: { req: {} }
    });

    const data = result.data as any;
    expect(data?.posts).toEqual({ id: 1, title: 'GraphQL Post' });
  });

  it('can fetch all items', async () => {
    const schema = service.generateSchema();
    const query = `
      query {
        allPosts {
          id
          title
        }
      }
    `;

    const result = await graphql({
      schema,
      source: query,
      contextValue: { req: {} }
    });

    const data = result.data as any;
    expect(data?.allPosts).toHaveLength(1);
    expect(data?.allPosts[0].title).toBe('GraphQL Post');
  });

  it('can create an item via mutation', async () => {
    const schema = service.generateSchema();
    const mutation = `
      mutation {
        createPosts(data: { title: "New Post", content: "Content" }) {
          id
          title
        }
      }
    `;

    const result = await graphql({
      schema,
      source: mutation,
      contextValue: { req: {} }
    });

    const data = result.data as any;
    expect(data?.createPosts).toEqual({ id: 2, title: 'New Post' });
  });
});
