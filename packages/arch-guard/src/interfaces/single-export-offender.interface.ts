import type { IModuleExport } from './module-export.interface';

/** A file that exports more than the one thing its kind allows. */
export interface ISingleExportOffender {
  file: string;
  /** What the filename itself promises the export must be — `'undeclared'` when it names neither. */
  declaredKind: 'interface' | 'enum' | 'undeclared';
  exports: IModuleExport[];
  reason: string;
}
