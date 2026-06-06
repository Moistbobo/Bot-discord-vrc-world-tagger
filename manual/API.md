# VRC World Tagger — API Guide

The bot exposes a REST API built on [Fastify](https://www.fastify.io/) for querying the world records
stored in its SQLite database. The API is designed for read-only consumption by dashboards, CI tools,
or any external service that needs access to the tagged world data.

---

## Base URL

```
http://<host>:<port>
```

| Setting | Default | Env Variable |
|---------|---------|-------------|
| Host    | `0.0.0.0` | — |
| Port    | `3000`     | `API_PORT` |

---

## Authentication

All endpoints **except** `GET /api/health` require a Bearer token.

```
Authorization: Bearer <your-api-token>
```

The token is configured via the `API_TOKEN` environment variable (falls back to
`EXPORT_API_TOKEN` for backwards compatibility).

If the header is missing, malformed, or the token does not match, the server responds
with `401 Unauthorized`.

---

## Endpoints

### 1. Health Check

```
GET /api/health
```

No authentication required. Returns basic server health and database stats.

**Example response**

```json
{
  "status": "ok",
  "worldCount": 1423,
  "dbVersion": 1
}
```

| Field        | Type   | Description                     |
|-------------|--------|---------------------------------|
| `status`    | string | Always `"ok"` when reachable.   |
| `worldCount`| number | Total number of world records.  |
| `dbVersion` | number | Schema version (currently `1`). |

---

### 2. List Worlds

```
GET /api/worlds
```

Returns a paginated, filterable list of world records.

**Query parameters**

| Parameter | Type             | Default | Max | Description                                        |
|-----------|------------------|---------|-----|----------------------------------------------------|
| `limit`   | number           | `50`    | 500 | Number of records to return.                       |
| `offset`  | number           | `0`     | —   | Number of records to skip (for pagination).        |
| `tag`     | string / string[] | —      | —   | Filter by tag(s). Multiple values use AND logic.   |

**Response**

```json
{
  "total": 1423,
  "limit": 50,
  "offset": 0,
  "worlds": [
    {
      "worldId": "wrld_abc123",
      "name": "Midnight Bar",
      "authorName": "VRChat",
      "capacity": 40,
      "platforms": ["android", "standalonewindows"],
      "tags": ["social", "hangout", "bar"],
      "imageUrl": "https://api.vrchat.cloud/api/1/file/...",
      "vrchatUrl": "https://vrchat.com/home/world/wrld_abc123",
      "quality": "good",
      "createdAt": "2025-06-01T12:00:00.000Z"
    }
  ]
}
```

**Filtering by tags**

To filter worlds that have **all** specified tags, repeat the `tag` parameter:

```
GET /api/worlds?tag=social&tag=hangout
```

**Pagination**

Use `limit` and `offset` to page through results. Each response includes the `total`
count so you can calculate the number of pages:

```
GET /api/worlds?limit=100&offset=200
```

---

### 3. Get Single World

```
GET /api/worlds/:worldId
```

Returns the most recent record for a specific VRChat world ID.

**Path parameter**

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| `worldId` | string | The VRChat world ID (e.g. `wrld_abc123`). |

**Response** — a single world object (same shape as the items in the list endpoint).

```json
{
  "worldId": "wrld_abc123",
  "name": "Midnight Bar",
  "authorName": "VRChat",
  "capacity": 40,
  "platforms": ["android", "standalonewindows"],
  "tags": ["social", "hangout", "bar"],
  "imageUrl": "https://api.vrchat.cloud/api/1/file/...",
  "vrchatUrl": "https://vrchat.com/home/world/wrld_abc123",
  "quality": "good",
  "createdAt": "2025-06-01T12:00:00.000Z"
}
```

**Error response** (world not found)

```json
{
  "error": "World not found"
}
```

Status code: **404**

---

### 4. List All Tags

```
GET /api/tags
```

Returns every unique tag across all world records, sorted by frequency (most common first).

**Response**

```json
{
  "tags": [
    { "tag": "social",    "count": 512 },
    { "tag": "hangout",   "count": 320 },
    { "tag": "game",      "count": 180 },
    { "tag": "avatar",    "count": 95 }
  ]
}
```

| Field   | Type   | Description                            |
|---------|--------|----------------------------------------|
| `tag`   | string | The tag value.                         |
| `count` | number | Number of world records using this tag.|

---

## World Record Schema

Each world object returned by the API has the following fields:

| Field         | Type                | Description                                                |
|---------------|---------------------|------------------------------------------------------------|
| `worldId`     | string              | VRChat world ID (e.g. `wrld_abc123`).                     |
| `name`        | string \| null      | Display name of the world.                                 |
| `authorName`  | string \| null      | Name of the author / creator.                              |
| `capacity`    | number \| null      | Maximum player capacity.                                   |
| `platforms`   | string[]            | Supported platforms (`android`, `standalonewindows`, etc.).|
| `tags`        | string[]            | Tags applied to this world record.                         |
| `imageUrl`    | string \| null      | Thumbnail image URL from VRChat API.                       |
| `vrchatUrl`   | string              | Link to the world on the VRChat website.                   |
| `quality`     | "good" \| "bad" \| null | Manual quality rating (if set).                       |
| `createdAt`   | string \| undefined | ISO 8601 timestamp of when the record was created.         |

---

## Error Responses

| Status Code | Meaning              | Body                              |
|-------------|----------------------|-----------------------------------|
| `401`       | Missing / invalid token | `{ "error": "Unauthorized" }`  |
| `404`       | World not found        | `{ "error": "World not found" }` |

---

## Example Usage (cURL)

```bash
# Health check (no auth)
curl http://localhost:3000/api/health

# List first 20 worlds tagged "social"
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds?limit=20&tag=social"

# Get a specific world
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds/wrld_abc123"

# List all tags
curl -H "Authorization: Bearer my-token" \
  http://localhost:3000/api/tags
```

---

## Notes

- The API is **read-only**. There are no endpoints to create, update, or delete records.
- Filtering by multiple tags uses **AND** logic: only worlds with *all* specified tags
  are returned.
- The `quality` field is set via Discord reactions (`👍` / `👎`) and reflects a
  manual rating applied to the world record.
- `createdAt` is returned as an ISO 8601 string (`new Date(timestamp * 1000).toISOString()`).