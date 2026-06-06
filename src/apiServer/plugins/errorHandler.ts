import { FastifyInstance } from 'fastify';
import logger from '../../utils/logger';

export default function registerErrorHandler(fastify: FastifyInstance) {
  // Catch any thrown error from route handlers or hooks
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;

    logger.error(`API error [${statusCode}] ${request.method} ${request.url}:`);
    logger.error(error);

    // Never leak stack traces or internal details to clients
    const clientMessage =
      statusCode >= 500
        ? 'Internal Server Error'
        : (error as Error).message || 'Unknown error';

    void reply.code(statusCode).send({ error: clientMessage });
  });

  // Clean 404s for unmatched routes (Fastify's default 404 is an HTML blob)
  fastify.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({ error: 'Not Found' });
  });
}
