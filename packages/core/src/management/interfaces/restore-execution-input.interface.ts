import { IRestorePreviewInput } from '@core/management/interfaces/restore-preview-input.interface';

export interface IRestoreExecutionInput extends IRestorePreviewInput {
  previewToken: string;
  confirmationText: string;
}
