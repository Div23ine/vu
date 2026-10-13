import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Object storage (Cloudflare R2, which speaks the S3 API).
 *
 * File bytes never pass through the API: the browser uploads straight to R2 with a
 * presigned PUT, and the API only issues the URL and later validates what landed
 * with `head()`. That keeps a 4 MB avatar from ever occupying a Fastify worker.
 */

export const AVATAR_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

export const AVATAR_MAX_BYTES = 4_194_304;
export const AVATAR_PREFIX = 'avatars/';
/** Presigned PUT URLs are short-lived: five minutes to start the upload. */
export const PRESIGN_PUT_SECONDS = 300;

const EXTENSIONS: Record<AvatarContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export function avatarExtension(contentType: string): string | null {
  const known = EXTENSIONS[contentType as AvatarContentType];
  return known ?? null;
}

export function isAllowedAvatarType(contentType: string): contentType is AvatarContentType {
  return (AVATAR_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export interface PresignPutInput {
  key: string;
  contentType: string;
  maxBytes: number;
  expiresSec: number;
}

export interface ObjectMetadata {
  size: number;
  contentType: string;
}

export interface ObjectStorage {
  presignPut(input: PresignPutInput): Promise<{ url: string; headers: Record<string, string> }>;
  head(key: string): Promise<ObjectMetadata | null>;
  delete(key: string): Promise<void>;
  presignGet(input: { key: string; expiresSec: number }): Promise<string>;
  publicUrl(key: string): string;
}

/**
 * Server-side writes (Task 90).
 *
 * The API never writes object bytes — browsers upload through presigned PUTs.
 * The workers do: rendered invoice/report PDFs and the daily audit snapshot
 * originate inside the platform. Kept as a SEPARATE interface so the dozens of
 * `ObjectStorage` test fakes in the API do not grow a method they never use.
 */
export interface ObjectWriter {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

export interface R2ObjectStorageOptions {
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Test seam. */
  client?: S3Client;
}

export class R2ObjectStorage implements ObjectStorage, ObjectWriter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(options: R2ObjectStorageOptions) {
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '');
    this.client =
      options.client ??
      new S3Client({
        region: 'auto',
        endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
        // R2 addresses buckets through the endpoint host, not a virtual host.
        forcePathStyle: true,
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      });
  }

  async presignPut(input: PresignPutInput) {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
      { expiresIn: input.expiresSec },
    );
    // The browser must send exactly this content type, or R2 rejects the upload.
    return { url, headers: { 'content-type': input.contentType } };
  }

  async head(key: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      const code = (error as { name?: string; $metadata?: { httpStatusCode?: number } }).name;
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (code === 'NotFound' || code === 'NoSuchKey' || status === 404) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async presignGet(input: { key: string; expiresSec: number }): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: input.key }),
      { expiresIn: input.expiresSec },
    );
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
