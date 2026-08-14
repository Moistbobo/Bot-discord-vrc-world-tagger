import Config from '../assets/config';
import logger from './logger';

const BASE_URL = (Config.API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  ''
);

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${Config.API_TOKEN}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    let message = `${method} ${path} failed with status ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body; keep default message
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface WorldRecord {
  id?: number;
  worldId: string;
  guildId: string;
  messageId: string;
  name: string | null;
  authorName: string | null;
  capacity: number | null;
  platforms: string[];
  packageSizes: (number | null)[];
  tags: string[];
  imageUrl: string | null;
  sourceContent: string | null;
  vrchatData: string | null;
  quality?: 'good' | 'bad' | null;
  createdAt?: number;
  updatedAt?: number;
  internalAddDate?: number | null;
}

export interface AddWorldRequest {
  worldId: string;
  guildId: string;
  messageId: string;
  content: string;
  messageTimestamp?: number;
  checkDuplicate?: boolean;
}

export type AddWorldResponse =
  | { duplicate: false; world: WorldRecord }
  | { duplicate: true; existingMessageId: string; world: WorldRecord };

export const api = {
  addWorld(req: AddWorldRequest): Promise<AddWorldResponse> {
    return request<AddWorldResponse>('POST', '/api/worlds', req);
  },

  deleteWorld(worldId: string, guildId: string): Promise<void> {
    return request<void>('DELETE', `/api/worlds/${worldId}`, { guildId });
  },

  setQuality(
    worldId: string,
    guildId: string,
    quality: 'good' | 'bad',
    messageTimestamp?: number
  ): Promise<{ updated: boolean }> {
    return request<{ updated: boolean }>(
      'PUT',
      `/api/worlds/${worldId}/quality`,
      {
        guildId,
        quality,
        messageTimestamp
      }
    );
  },

  setTags(
    worldId: string,
    guildId: string,
    tags: string[],
    sourceContent: string | null,
    messageTimestamp?: number
  ): Promise<{ updated: boolean }> {
    return request<{ updated: boolean }>('PUT', `/api/worlds/${worldId}/tags`, {
      guildId,
      tags,
      sourceContent,
      messageTimestamp
    });
  },

  getWorld(worldId: string): Promise<WorldRecord | null> {
    return request<WorldRecord | null>(`GET`, `/api/worlds/${worldId}`).catch(
      (error) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    );
  },

  getWorldPairs(): Promise<{ worldId: string; guildId: string }[]> {
    return request<{ pairs: { worldId: string; guildId: string }[] }>(
      'GET',
      '/api/worlds/pairs'
    ).then((data) => data.pairs);
  },

  getLastProcessedWorld(): Promise<WorldRecord | null> {
    return request<{ worlds: WorldRecord[] }>(
      'GET',
      '/api/worlds?limit=1'
    ).then((data) => data.worlds[0] ?? null);
  },

  getStats(): Promise<{
    worldCount: number;
    topTags: { tag: string; count: number }[];
  }> {
    return Promise.all([
      request<{ worldCount: number }>('GET', '/api/health'),
      request<{ tags: { tag: string; count: number }[] }>('GET', '/api/tags')
    ]).then(([health, tags]) => ({
      worldCount: health.worldCount,
      topTags: tags.tags
    }));
  }
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function apiHealthCheck(): Promise<boolean> {
  try {
    await api.getStats();
    return true;
  } catch (error) {
    logger.error('API health check failed:', error);
    return false;
  }
}
