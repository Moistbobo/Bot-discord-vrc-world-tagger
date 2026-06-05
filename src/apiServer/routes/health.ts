import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../utils/database/worldRepository';

const healthRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/api/health', async () => {
    const count = getWorldRepository().count();
    return {
      status: 'ok',
      worldCount: count,
      dbVersion: 1
    };
  });
};

export default healthRoute;
