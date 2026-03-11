/** Type definitions for EnvConfig */
import { z } from 'zod';
import type { EnvConfig } from './env';

export type Env = z.infer<typeof EnvConfig.schema>;
