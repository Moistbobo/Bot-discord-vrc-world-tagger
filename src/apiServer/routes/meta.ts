import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../utils/database/worldRepository';

const metaRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/meta
  fastify.get('/api/meta', async () => {
    return getWorldRepository().getMetadataCounts();
  });
};

export default metaRoute;
