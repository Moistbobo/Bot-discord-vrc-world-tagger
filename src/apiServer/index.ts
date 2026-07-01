import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import logger from '../utils/logger';
import Config from '../assets/config';
import healthRoute from './routes/health';
import worldsRoute from './routes/worlds';
import tagsRoute from './routes/tags';
import registerErrorHandler from './plugins/errorHandler';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '').toLowerCase();
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (Config.API_ALLOWED_ORIGINS.length === 0) return true;
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return Config.API_ALLOWED_ORIGINS.some(
    (allowed) => normalizeOrigin(allowed) === normalized
  );
}

function isAllowedIp(ip: string | undefined): boolean {
  if (Config.API_ALLOWED_IPS.length === 0) return true;
  if (!ip) return false;
  return Config.API_ALLOWED_IPS.includes(ip);
}

export function createApiServer() {
  const fastify = Fastify({
    logger: false, // we'll use our own logger
    // Trust loopback reverse proxies (Caddy/Nginx on the same host) when IP
    // allowlisting is enabled so request.ip reflects the real client IP.
    trustProxy:
      Config.API_ALLOWED_IPS.length > 0 ? ['127.0.0.1/32', '::1/128'] : false
  });

  registerErrorHandler(fastify);

  // CORS: allow configured origins, or fall back to wildcard for backwards compatibility.
  const corsOptions =
    Config.API_ALLOWED_ORIGINS.length > 0
      ? { origin: Config.API_ALLOWED_ORIGINS }
      : { origin: '*' };
  void fastify.register(cors, corsOptions);

  // Origin + IP validation hook (skip health endpoint so monitoring can still ping it).
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/health') return;

    const hasOriginRules = Config.API_ALLOWED_ORIGINS.length > 0;
    const hasIpRules = Config.API_ALLOWED_IPS.length > 0;

    // Nothing configured; let auth handle access control.
    if (!hasOriginRules && !hasIpRules) return;

    const originOk = hasOriginRules && isAllowedOrigin(request.headers.origin);
    const ipOk = hasIpRules && isAllowedIp(request.ip);

    // Request must satisfy at least one configured restriction.
    if (!originOk && !ipOk) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  // Auth hook (skip health endpoint)
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/health') return;

    const auth = request.headers.authorization;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = auth.slice(7).trim();
    if (!Config.API_TOKEN.includes(token)) {
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
  const host = Config.API_HOST;

  try {
    await fastify.listen({ port, host });
    apiServerInstance = fastify;
    isApiRunning = true;
    logger.info(`🚀 API server listening on http://${host}:${port}`);
  } catch (error) {
    logger.error('Failed to start API server:', error);
  }

  return fastify;
}
