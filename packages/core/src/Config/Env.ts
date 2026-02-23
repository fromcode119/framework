import { z } from 'zod';

/**
 * Environment variables schema for Fromcode Framework.
 * This provides type-safety and validation for all system configurations.
 */
export const envSchema = z.object({
  // Core Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((v) => parseInt(v, 10)).default('4000'),

  // Service Discovery & External Networking
  API_URL: z.string().url().optional(),
  ADMIN_URL: z.string().url().optional(),
  MARKETPLACE_URL: z.string().url().default('https://marketplace.fromcode.com/marketplace.json'),

  // Database Configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_DIALECT: z.enum(['postgres', 'mysql', 'sqlite']).default('postgres'),

  // Redis / Caching
  REDIS_URL: z.preprocess(v => (v === '' ? undefined : v), z.string().url().optional()),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().transform((v) => parseInt(v, 10)).optional(),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().optional(),

  // Storage (Local/S3/R2)
  STORAGE_DRIVER: z.enum(['local', 's3', 'r2']).default('local'),
  STORAGE_ROOT: z.string().default('public/uploads'),
  
  // AWS S3 / R2 Configuration (Optional if not using S3/R2)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_BUCKET: z.string().optional(),
  AWS_ENDPOINT: z.string().optional(),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['smtp', 'resend', 'sendgrid', 'ses']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform((v) => parseInt(v, 10)).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Plugin Sandboxing
  SANDBOX_MEMORY_LIMIT: z.string().transform((v) => parseInt(v, 10)).default('128'),
  SANDBOX_TIMEOUT: z.string().transform((v) => parseInt(v, 10)).default('50'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the current environment variables.
 * Throws an error with descriptive details if validation fails.
 */
export const validateEnv = (): Env => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('❌ Invalid Environment Configuration:');
      result.error.issues.forEach((issue) => {
        console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
      });
    }
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  return result.data as Env;
};

export const env = validateEnv();
