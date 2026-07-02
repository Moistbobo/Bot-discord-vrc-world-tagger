import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../utils/database/worldRepository';
import { parseIntegerParam, parseStringListQuery } from '../utils/queryParams';

const filterCountsRoute: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // GET /api/filter-counts
  fastify.get('/api/filter-counts', async (request, reply) => {
    const query = request.query as Record<string, unknown>;

    const tags = parseStringListQuery(query.tag);
    const platforms = parseStringListQuery(query.platform);

    const quality = Array.isArray(query.quality)
      ? query.quality
          .map(String)
          .filter((q): q is 'good' | 'bad' => q === 'good' || q === 'bad')
      : query.quality && (query.quality === 'good' || query.quality === 'bad')
        ? [String(query.quality) as 'good' | 'bad']
        : undefined;

    let minCapacity: number | undefined;
    let maxCapacity: number | undefined;
    try {
      minCapacity = parseIntegerParam(query.minCapacity, {
        name: 'minCapacity',
        min: 1,
        max: 80
      });
      maxCapacity = parseIntegerParam(query.maxCapacity, {
        name: 'maxCapacity',
        min: 1,
        max: 80
      });
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : 'Invalid capacity filter'
      });
    }

    if (
      minCapacity !== undefined &&
      maxCapacity !== undefined &&
      minCapacity > maxCapacity
    ) {
      return reply.code(400).send({
        error: 'minCapacity must be less than or equal to maxCapacity'
      });
    }

    const filters: {
      platforms?: string[];
      tags?: string[];
      quality?: ('good' | 'bad')[];
      search?: string;
      minCapacity?: number;
      maxCapacity?: number;
    } = {};
    if (tags) filters.tags = tags;
    if (platforms) filters.platforms = platforms;
    if (quality) filters.quality = quality;
    if (minCapacity !== undefined) filters.minCapacity = minCapacity;
    if (maxCapacity !== undefined) filters.maxCapacity = maxCapacity;

    const search =
      typeof query.search === 'string' ? query.search.trim() : undefined;
    if (search) filters.search = search;

    const { qualityCounts, platformCounts } =
      getWorldRepository().getFilterCounts(
        Object.keys(filters).length > 0 ? filters : undefined
      );

    return { qualityCounts, platformCounts };
  });
};

export default filterCountsRoute;
