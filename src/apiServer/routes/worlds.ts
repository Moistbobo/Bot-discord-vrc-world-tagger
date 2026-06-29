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
    createdAt: toDateString(raw.createdAt),
    internalAddDate: toDateString(raw.internalAddDate ?? undefined)
  };
}

function parseStringListQuery(raw: unknown): string[] | undefined {
  if (!raw) return undefined;

  const sources = Array.isArray(raw) ? raw.map(String) : [String(raw)];

  const values = sources
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);

  // Deduplicate while preserving first-appearance order
  const seen = new Set<string>();
  return values.filter((v) => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function parseIntegerParam(
  raw: unknown,
  options: { min?: number; max?: number; name: string }
): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${options.name} must be an integer`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${options.name} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`${options.name} must be at most ${options.max}`);
  }

  return value;
}

const worldsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/worlds
  fastify.get('/api/worlds', async (request, reply) => {
    const query = request.query as Record<string, unknown>;

    const limit = Math.min(Number(query.limit ?? 50), 500);
    const offset = Number(query.offset ?? 0);

    const tags = parseStringListQuery(query.tag);
    const platforms = parseStringListQuery(query.platform);
    const worldIds = parseStringListQuery(query.worldId);

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
      worldIds?: string[];
    } = {};
    if (tags) filters.tags = tags;
    if (platforms) filters.platforms = platforms;
    if (worldIds) filters.worldIds = worldIds;
    if (quality) filters.quality = quality;
    if (minCapacity !== undefined) filters.minCapacity = minCapacity;
    if (maxCapacity !== undefined) filters.maxCapacity = maxCapacity;

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
