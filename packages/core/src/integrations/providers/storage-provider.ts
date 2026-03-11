import { MediaManager, StorageFactory } from '@fromcode119/media';
import type { IntegrationTypeDefinition } from '../integration-registry.interfaces';
import path from 'path';

export const StorageIntegrationDefinition: IntegrationTypeDefinition<MediaManager> = {
  key: 'storage',
  label: 'File Storage',
  description: 'Provider used for storing and retrieving uploaded media and files.',
  defaultProvider: 'local',
  resolveFromEnv: () => {
    const driver = process.env.STORAGE_DRIVER || 'local';
    const config: Record<string, any> = {};

    if (driver === 'local') {
      config.uploadDir = process.env.STORAGE_UPLOAD_DIR || 'public/uploads';
      config.publicUrlBase = process.env.STORAGE_PUBLIC_URL || '/uploads';
    } else if (driver === 's3') {
      config.region = process.env.STORAGE_S3_REGION || 'auto';
      config.bucket = process.env.STORAGE_S3_BUCKET || '';
      config.endpoint = process.env.STORAGE_S3_ENDPOINT;
      config.accessKeyId = process.env.STORAGE_S3_KEY || '';
      config.secretAccessKey = process.env.STORAGE_S3_SECRET || '';
      config.publicUrlBase = process.env.STORAGE_PUBLIC_URL;
    }

    return { provider: driver, config };
  },
  providers: [
    {
      key: 'local',
      label: 'Local File System',
      description: 'Stores files on the local disk of the server.',
      fields: [
        {
          name: 'uploadDir',
          label: 'Upload Directory',
          type: 'text',
          required: true,
          placeholder: 'public/uploads'
        },
        {
          name: 'publicUrlBase',
          label: 'Public URL Base',
          type: 'text',
          required: true,
          placeholder: '/uploads'
        }
      ],
      create: (config, context) => {
        const absolutePath = path.isAbsolute(config.uploadDir) 
          ? config.uploadDir 
          : path.resolve(context?.projectRoot || process.cwd(), config.uploadDir);
        return new MediaManager(StorageFactory.create('local', { ...config, uploadDir: absolutePath }));
      }
    },
    {
      key: 's3',
      label: 'S3 Compatible Storage',
      description: 'Cloud storage using AWS S3 or compatible services (DigitalOcean Spaces, MinIO, etc.).',
      fields: [
        { name: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
        { name: 'bucket', label: 'Bucket Name', type: 'text', required: true },
        { name: 'endpoint', label: 'Endpoint URL', type: 'text', placeholder: 'https://...' },
        { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
        { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
        { name: 'publicUrlBase', label: 'Public URL Base', type: 'text', placeholder: 'https://cdn.example.com' }
      ],
      create: (config) => {
        const s3Config = {
          region: config.region,
          bucket: config.bucket,
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
          },
          publicUrlBase: config.publicUrlBase
        };
        return new MediaManager(StorageFactory.create('s3', s3Config as any));
      }
    }
  ]
};