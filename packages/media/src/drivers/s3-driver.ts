import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { StorageDriver } from '../index';

export class S3StorageDriver implements StorageDriver {
    public readonly provider: string;
    private client: S3Client;
    private bucket: string;
    private publicUrlBase: string;

    constructor(options: { 
        provider?: string;
        region: string; 
        bucket: string; 
        endpoint?: string; 
        credentials: { accessKeyId: string; secretAccessKey: string };
        publicUrlBase?: string;
    }) {
        this.provider = options.provider || 's3';
        this.client = new S3Client({
            region: options.region,
            endpoint: options.endpoint,
            credentials: options.credentials,
            forcePathStyle: !!options.endpoint // Required for R2/LocalStack
        });
        this.bucket = options.bucket;
        this.publicUrlBase = options.publicUrlBase || `https://${options.bucket}.s3.${options.region}.amazonaws.com`;
    }

    async save(file: Buffer, filename: string, options?: any): Promise<string> {
        const ext = path.extname(filename);
        const basename = path.basename(filename, ext);
        const id = uuidv4();
        const newFilename = `${basename}-${id}${ext}`;
        
        const upload = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: newFilename,
                Body: file,
                ContentType: options?.contentType || 'application/octet-stream'
            }
        });

        await upload.done();
        return newFilename;
    }

    async read(filepath: string): Promise<Buffer> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: filepath
        }));
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    async delete(filepath: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: filepath
        }));
    }

    getUrl(filepath: string): string {
        return `${this.publicUrlBase}/${filepath}`;
    }
}
