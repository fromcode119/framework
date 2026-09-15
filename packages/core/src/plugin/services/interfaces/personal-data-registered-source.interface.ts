import type { IPersonalDataSourceDescriptor } from '@core/plugin/services/interfaces/personal-data-source-descriptor.interface';

/** A registered source, with the callbacks the framework built for it. */
export interface IPersonalDataRegisteredSource extends IPersonalDataSourceDescriptor {
  invoke: {
    exportSubject(subject: unknown): Promise<Record<string, unknown>[]>;
    eraseSubject(subject: unknown, strategy: string): Promise<Record<string, unknown>>;
  };
}
