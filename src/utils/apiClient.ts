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

/**
 * Shape returned by the API's sanitized GET endpoints
 * (`GET /api/worlds/:worldId`, `GET /api/worlds?limit=1`). The API strips
 * guild/message/source fields and returns ISO timestamps, so this is distinct
 * from `WorldRecord` (the POST/PUT response shape).
 */
export interface SanitizedWorldRecord {
  worldId: string;
  name: string | null;
  authorName: string | null;
  capacity: number | null;
  platforms: string[];
  packageSizes: (number | null)[];
  tags: string[];
  imageUrl: string | null;
  vrchatUrl: string;
  quality: 'good' | 'bad' | null;
  createdAt?: string;
  internalAddDate?: string;
}

export interface World {
  id: string;
  name: string;
  authorName: string;
  capacity: number;
  imageUrl: string;
  unityPackages: { platform?: string }[];
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

  setHighPriority(
    worldId: string,
    guildId: string
  ): Promise<{ added: boolean }> {
    return request<{ added: boolean }>(
      'PUT',
      `/api/worlds/${worldId}/high-priority`,
      { guildId }
    );
  },

  removeHighPriority(
    worldId: string,
    guildId: string
  ): Promise<{ removed: boolean }> {
    return request<{ removed: boolean }>(
      'DELETE',
      `/api/worlds/${worldId}/high-priority`,
      { guildId }
    );
  },

  setTags(
    worldId: string,
    guildId: string,
    sourceContent: string | null,
    tagSource?: string,
    messageTimestamp?: number
  ): Promise<{ updated: boolean; tags: string[] }> {
    return request<{ updated: boolean; tags: string[] }>(
      'PUT',
      `/api/worlds/${worldId}/tags`,
      {
        guildId,
        sourceContent,
        tagSource,
        messageTimestamp
      }
    );
  },

  getWorld(worldId: string): Promise<SanitizedWorldRecord | null> {
    return request<SanitizedWorldRecord | null>(
      `GET`,
      `/api/worlds/${worldId}`
    ).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    });
  },

  extractWorlds(
    content: string
  ): Promise<{ worldId: string; sourceContent: string }[]> {
    return request<{ worlds: { worldId: string; sourceContent: string }[] }>(
      'POST',
      '/api/worlds/extract',
      { content }
    ).then((data) => data.worlds);
  },

  getWorldIds(): Promise<string[]> {
    return request<{ ids: string[] }>('GET', '/api/worlds/ids').then(
      (data) => data.ids
    );
  },

  getLastProcessedWorld(): Promise<SanitizedWorldRecord | null> {
    return request<{ worlds: SanitizedWorldRecord[] }>(
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
