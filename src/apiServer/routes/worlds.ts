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

function parseTagQuery(raw: unknown): string[] | undefined {
  if (!raw) return undefined;

  const sources = Array.isArray(raw) ? raw.map(String) : [String(raw)];

  const tags = sources
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);

  // Deduplicate while preserving first-appearance order
  const seen = new Set<string>();
  return tags.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

const worldsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/worlds
  fastify.get('/api/worlds', async (request) => {
    const query = request.query as Record<string, unknown>;

    const limit = Math.min(Number(query.limit ?? 50), 500);
    const offset = Number(query.offset ?? 0);

    const tags = parseTagQuery(query.tag);

    const quality = Array.isArray(query.quality)
      ? query.quality
          .map(String)
          .filter((q): q is 'good' | 'bad' => q === 'good' || q === 'bad')
      : query.quality && (query.quality === 'good' || query.quality === 'bad')
        ? [String(query.quality) as 'good' | 'bad']
        : undefined;

    const filters: {
      tags?: string[];
      quality?: ('good' | 'bad')[];
      search?: string;
    } = {};
    if (tags) filters.tags = tags;
    if (quality) filters.quality = quality;

    const search =
      typeof query.search === 'string' ? query.search.trim() : undefined;
    if (search) filters.search = search;

    const { rows, total } = getWorldRepository().getAllPaginated(
      limit,
      offset,
      Object.keys(filters).length > 0 ? filters : undefined
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
