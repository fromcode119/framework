import path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { IStorageDriver } from '@media/index';

export class S3StorageDriver implements IStorageDriver {
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
        const id = randomUUID();
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

    /**
     * The SDK already hands back a streaming body — `read` buffers it only because its caller wanted a
     * Buffer. Passing it through avoids holding an arbitrarily large object in memory.
     */
    async stream(filepath: string): Promise<Readable> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: filepath
        }));
        const body = response.Body as AsyncIterable<Uint8Array> | undefined;
        if (!body) throw new Error(`Object has no body: ${filepath}`);
        return body instanceof Readable ? body : Readable.from(body);
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
