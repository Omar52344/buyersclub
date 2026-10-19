import { createReadStream, existsSync } from 'node:fs';
import type { Readable } from 'node:stream';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, eq, or } from 'drizzle-orm';
import { jwtVerify } from 'jose';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { db } from '../../db/index';
import {
  businesses,
  conversations,
  files,
  messages,
  orders,
  payments,
} from '../../db/schema';
import { config } from '../../config';
import { AppError } from '../../errors';

const uploadRoot = path.resolve(process.cwd(), config.UPLOAD_DIR);
const key = new TextEncoder().encode(config.JWT_SECRET);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

let s3Client: S3Client | null | undefined;
let bucketReady = false;

function getS3(): S3Client | null {
  if (
    !config.S3_ENDPOINT ||
    !config.S3_BUCKET ||
    !config.S3_ACCESS_KEY_ID ||
    !config.S3_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  if (s3Client === undefined) {
    s3Client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

async function ensureBucket(client: S3Client): Promise<void> {
  if (bucketReady || !config.S3_BUCKET) {
    return;
  }
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
  }
  bucketReady = true;
}

export function uploadPath(): string {
  return uploadRoot;
}

export async function saveUpload(input: {
  userId: string;
  mime: string;
  buffer: Buffer;
}) {
  if (!ALLOWED_MIME.has(input.mime)) {
    throw new AppError(
      'UNSUPPORTED_FILE',
      'Solo se permiten imágenes JPG, PNG o WebP.',
      422,
    );
  }
  if (input.buffer.length === 0 || input.buffer.length > MAX_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'La imagen debe pesar menos de 10 MB.', 422);
  }

  const extension =
    input.mime === 'image/png' ? 'png' : input.mime === 'image/webp' ? 'webp' : 'jpg';
  const keyName = `${randomUUID()}.${extension}`;

  const client = getS3();
  if (client) {
    await ensureBucket(client);
    await client.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: keyName,
        Body: input.buffer,
        ContentType: input.mime,
      }),
    );
  } else {
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(path.join(uploadRoot, keyName), input.buffer);
  }

  const [file] = await db
    .insert(files)
    .values({
      ownerUserId: input.userId,
      bucket: 'private',
      key: keyName,
      mime: input.mime,
      sizeBytes: input.buffer.length,
      status: 'ready',
    })
    .returning();

  if (!file) {
    throw new AppError('FILE_SAVE_FAILED', 'No pudimos guardar la imagen.', 500);
  }
  return file;
}

export async function authorizeFile(fileId: string, userId: string) {
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) {
    throw new AppError('FILE_NOT_FOUND', 'La imagen no existe.', 404);
  }
  if (file.ownerUserId === userId) {
    return file;
  }

  const [paymentLink] = await db
    .select({ id: payments.id })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .innerJoin(businesses, eq(orders.businessId, businesses.id))
    .where(
      and(
        eq(payments.evidenceFileId, fileId),
        or(eq(orders.buyerUserId, userId), eq(businesses.ownerUserId, userId)),
      ),
    )
    .limit(1);

  if (paymentLink) {
    return file;
  }

  const [messageLink] = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(businesses, eq(conversations.businessId, businesses.id))
    .where(
      and(
        eq(messages.fileId, fileId),
        or(
          eq(conversations.buyerUserId, userId),
          eq(businesses.ownerUserId, userId),
        ),
      ),
    )
    .limit(1);

  if (messageLink) {
    return file;
  }

  throw new AppError('FORBIDDEN', 'No tienes acceso a esta imagen.', 403);
}

export async function authorizeFileToken(fileId: string, token: string) {
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, key);
    if (
      payload.typ !== 'file' ||
      payload.fileId !== fileId ||
      typeof payload.sub !== 'string'
    ) {
      throw new Error('Token de archivo inválido');
    }
    userId = payload.sub;
  } catch {
    throw new AppError('UNAUTHORIZED', 'El enlace de la imagen expiró.', 401);
  }
  return authorizeFile(fileId, userId);
}

export async function fileStream(fileKey: string): Promise<Readable> {
  const client = getS3();
  if (client) {
    const response = await client.send(
      new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: fileKey }),
    );
    return response.Body as unknown as Readable;
  }

  const filePath = path.join(uploadRoot, fileKey);
  if (!existsSync(filePath)) {
    throw new AppError('FILE_NOT_FOUND', 'La imagen no existe en el servidor.', 404);
  }
  return createReadStream(filePath);
}
