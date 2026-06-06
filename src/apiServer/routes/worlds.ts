import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../utils/database/worldRepository';
import type { WorldRecord } from '../../utils/database/worldRepository';

function toDateString(timestamp: number | undefined): string | undefined {
  if (!timestamp) return undefined;
  return new Date(timestamp * 1000).toISOString();
}

function buildWorldUrl(worldId: string): string {
  return `https://vrchat.com/home/world/${worldId}`;
}

function sanitizeRecord(raw: WorldRecord) {
  return {
    worldId: raw.worldId,
    name: raw.name,
    authorName: raw.authorName,
    capacity: raw.capacity,
    platforms: raw.platforms,
    tags: raw.tags,
    imageUrl: raw.imageUrl,
    vrchatUrl: buildWorldUrl(raw.worldId),
    quality: raw.quality ?? null,
    createdAt: toDateString(raw.createdAt)
  };
}

const worldsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/worlds
  fastify.get('/api/worlds', async (request) => {
    const query = request.query as Record<string, unknown>;

    const limit = Math.min(Number(query.limit ?? 50), 500);
    const offset = Number(query.offset ?? 0);

    const tags = Array.isArray(query.tag)
      ? query.tag.map(String)
      : query.tag
        ? [String(query.tag)]
        : undefined;

    const { rows, total } = getWorldRepository().getAllPaginated(
      limit,
      offset,
      tags ? { tags } : undefined
    );

    return {
      total,
      limit,
      offset,
      worlds: rows.map(sanitizeRecord)
    };
  });

  // GET /api/worlds/:worldId
  fastify.get('/api/worlds/:worldId', async (request, reply) => {
    const { worldId } = request.params as { worldId: string };
    const matches = getWorldRepository().getByWorldId(worldId);

    if (matches.length === 0) {
      return reply.code(404).send({ error: 'World not found' });
    }

    // Return first live match (most recent by created_at DESC)
    return sanitizeRecord(matches[0]);
  });
};

export default worldsRoute;
