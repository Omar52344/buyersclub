import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../errors';
import { requireUserId } from '../../lib/auth-guard';
import { buildFileUrl } from '../../lib/file-token';
import {
  authorizeFile,
  authorizeFileToken,
  fileStream,
  saveUpload,
} from './service';

export const fileRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/files',
    { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } },
    async (request, reply) => {
    const userId = await requireUserId(request);
    const data = await request.file();
    if (!data) {
      throw new AppError('FILE_REQUIRED', 'Adjunta una imagen.', 400);
    }
    const buffer = await data.toBuffer();
    const file = await saveUpload({ userId, mime: data.mimetype, buffer });
    return reply.status(201).send({
      file: {
        id: file.id,
        mime: file.mime,
        sizeBytes: Number(file.sizeBytes),
        url: await buildFileUrl(file.id, userId),
      },
    });
  });

  app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/files/:id',
    async (request, reply) => {
      const file = request.query.token
        ? await authorizeFileToken(request.params.id, request.query.token)
        : await authorizeFile(request.params.id, await requireUserId(request));

      return reply
        .type(file.mime)
        .header('Cache-Control', 'private, max-age=300')
        .send(await fileStream(file.key));
    },
  );
};
