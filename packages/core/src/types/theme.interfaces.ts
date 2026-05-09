import type { ThemeManifestInput } from '../manifest-normalizer.types';

export interface FromcodeTheme {
  manifest: ThemeManifestInput;
  init?: () => void;
}
