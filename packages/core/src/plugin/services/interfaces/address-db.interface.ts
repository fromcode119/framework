export interface IAddressDb {
  find(table: string, opts?: any): Promise<any[]>;
  findOne(table: string, where: any): Promise<any | null>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, where: any, data: any): Promise<any>;
  delete(table: string, where: any): Promise<any>;
}
