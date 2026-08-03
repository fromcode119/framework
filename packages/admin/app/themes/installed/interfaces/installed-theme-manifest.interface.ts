
import { IThemeManifest } from '@fromcode119/core/client';

import { ThemeState } from '@fromcode119/core/client';

export interface IInstalledThemeManifest extends IThemeManifest {
  downloadUrl?: string;
  iconUrl?: string;
  state?: ThemeState;
}
