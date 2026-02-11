export interface CollectionQueryBuilder {
  find(options?: any): Promise<any[]>;
  findOne(where: any): Promise<any | null>;
  insert(data: any): Promise<any>;
  update(where: any, data: any): Promise<any>;
  delete(where: any): Promise<boolean>;
  count(where?: any): Promise<number>;
}

export interface PluginProxy {
  slug: string;
  collection(name: string): CollectionQueryBuilder;
  [key: string]: any; 
}
