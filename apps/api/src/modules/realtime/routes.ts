import type { FastifyPluginAsync } from 'fastify';
import { verifyAccessToken } from '../../lib/tokens';
import { addConnection, removeConnection } from '../../lib/realtime';

export const realtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { token?: string } }>(
    '/realtime',
    { websocket: true },
    (socket, request) => {
      const token = request.query.token;
      if (!token) {
        socket.close(1008, 'unauthorized');
        return;
      }

      verifyAccessToken(token)
        .then((userId) => {
          addConnection(userId, socket);
          socket.send(JSON.stringify({ type: 'ready' }));
          socket.on('close', () => removeConnection(userId, socket));
          socket.on('error', () => removeConnection(userId, socket));
        })
        .catch(() => {
          socket.close(1008, 'unauthorized');
        });
    },
  );
};
