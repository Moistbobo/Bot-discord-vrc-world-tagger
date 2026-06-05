import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import logger from '../utils/logger';
import Config from '../assets/config';
import healthRoute from './routes/health';
import worldsRoute from './routes/worlds';
import tagsRoute from './routes/tags';

export function createApiServer() {
  const fastify = Fastify({
    logger: false // we'll use our own logger
  });

  // CORS for GitHub Pages / browser consumers
  void fastify.register(cors, { origin: '*' });

  // Auth hook (skip health endpoint)
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/health') return;

    const auth = request.headers.authorization;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = auth.slice(7).trim();
    if (token !== Config.API_TOKEN) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Routes
  fastify.register(healthRoute);
  fastify.register(worldsRoute);
  fastify.register(tagsRoute);

  return fastify;
}

let apiServerInstance: FastifyInstance | null = null;
let isApiRunning = false;

export function isApiServerRunning(): boolean {
  return isApiRunning;
}

export async function stopApiServer(): Promise<void> {
  if (apiServerInstance) {
    await apiServerInstance.close();
    apiServerInstance = null;
    isApiRunning = false;
    logger.info('🛑 API server stopped');
  }
}

export async function startApiServer() {
  const fastify = createApiServer();
  const port = Config.API_PORT;

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    apiServerInstance = fastify;
    isApiRunning = true;
    logger.info(`🚀 API server listening on http://0.0.0.0:${port}`);
  } catch (error) {
    logger.error('Failed to start API server:', error);
  }

  return fastify;
}
