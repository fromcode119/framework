/** One top-level export, read from a file's AST. */
export interface IModuleExport {
  kind: 'class' | 'interface' | 'function' | 'variable' | 'type' | 'enum' | 'other';
  name: string;
}
