import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../utils/database/worldRepository';

const tagsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/api/tags', async () => {
    const tags = getWorldRepository().getUniqueTags();
    return {
      tags: tags.sort((a, b) =>
        a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' })
      )
    };
  });
};

export default tagsRoute;
