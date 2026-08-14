import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../utils/database/worldRepository';

const tagsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/api/tags', async () => {
    const tags = getWorldRepository().getUniqueTags();
    return { tags };
  });
};

export default tagsRoute;
