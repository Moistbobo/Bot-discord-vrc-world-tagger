# VRC World Tagger — API Guide

The bot exposes a read-only REST API built on [Fastify](https://www.fastify.io/) for querying the world records stored in its SQLite database. It is intended for dashboards, CI tools, or any external service that needs access to the tagged world data.

---

## Base URL

```
http://<host>:<port>
```

| Setting | Default | Env Variable |
|---------|---------|--------------|
| Host    | `0.0.0.0` | `API_HOST`   |
| Port    | `3000`    | `API_PORT`   |

The API server starts automatically when the bot launches and can also be started/stopped via the `.apiStart` and `.apiStop` Discord commands.

---

## Authentication

All endpoints **except** `GET /api/health` require a valid Bearer token:

```
Authorization: Bearer <your-api-token>
```

The token is configured via the `API_TOKEN` environment variable (supports multiple comma-separated tokens) and falls back to `EXPORT_API_TOKEN` for backwards compatibility.

If the header is missing, malformed, or the token does not match, the server responds with `401 Unauthorized`.

---

## Origin and IP Restrictions

You can lock down the API so only specific browser origins and/or source IP addresses can reach it. Configure these via environment variables:

| Variable | Description |
|----------|-------------|
| `API_ALLOWED_ORIGINS` | Comma-separated list of allowed `Origin` values. Used for CORS preflight and origin header validation. Example: `https://sosd.googoogaagaa.club,https://testnet.googoogaagaa.club`. |
| `API_ALLOWED_IPS` | Comma-separated list of allowed source IP addresses. Example: `203.0.113.42,127.0.0.1`. When set, the API trusts loopback reverse proxies (e.g. Caddy or Nginx on the same host) to provide the real client IP via `X-Forwarded-For`. |

A request to any endpoint except `/api/health` must satisfy **at least one** configured restriction in addition to presenting a valid token:

- Its `Origin` header matches one of the allowed origins, **or**
- Its source IP matches one of the allowed IPs.

If neither rule is configured, only Bearer token auth is enforced and CORS falls back to the wildcard `*` for backwards compatibility. The health endpoint remains publicly reachable for monitoring.

### Recommended setup

For browser consumers hosted on `https://sosd.googoogaagaa.club` and `https://testnet.googoogaagaa.club`, plus personal admin/scripted access from `203.0.113.42`:

```dotenv
API_ALLOWED_ORIGINS=https://sosd.googoogaagaa.club,https://testnet.googoogaagaa.club
API_ALLOWED_IPS=203.0.113.42,127.0.0.1
```

Run the API bound to the loopback interface and put a reverse proxy such as Caddy in front of it for TLS termination and additional IP filtering:

```dotenv
API_HOST=127.0.0.1
API_PORT=3069
```

Example `Caddyfile`:

```caddy
sosd.googoogaagaa.club, testnet.googoogaagaa.club {
    reverse_proxy 127.0.0.1:3069
}
```

---

## Endpoints

### 1. Health Check

```
GET /api/health
```

No authentication or origin/IP restrictions required. Returns basic server health and database stats.

**Example response**

```json
{
  "status": "ok",
  "worldCount": 1423,
  "dbVersion": 1
}
```

| Field        | Type   | Description                     |
|--------------|--------|---------------------------------|
| `status`     | string | Always `"ok"` when reachable.   |
| `worldCount` | number | Total number of world records.  |
| `dbVersion`  | number | Schema version (currently `1`). |

---

### 2. List Worlds

```
GET /api/worlds
```

Returns a paginated, filterable list of world records.

**Query parameters**

| Parameter     | Type              | Default | Max | Description |
|---------------|-------------------|---------|-----|-------------|
| `limit`       | number            | `50`    | 500 | Number of records to return. |
| `offset`      | number            | `0`     | —   | Number of records to skip (for pagination). |
| `tag`         | string / string[] | —       | —   | Filter by tag(s). Comma-separated or repeated. Multiple values use AND logic. |
| `platform`    | string / string[] | —       | —   | Filter by supported platform(s). Comma-separated or repeated. Multiple values use AND logic. |
| `quality`     | string / string[] | —       | —   | Filter by quality. Values: `good`, `bad`. |
| `search`      | string            | —       | —   | Search across name, author, source content, world id, and tags. |
| `minCapacity` | integer           | —       | —   | Minimum world capacity (inclusive). Must be ≥ 1 and ≤ 80. |
| `maxCapacity` | integer           | —       | —   | Maximum world capacity (inclusive). Must be ≥ 1 and ≤ 80. |
| `worldId`     | string / string[] | —       | —   | Filter to specific world ID(s). Comma-separated or repeated. Exact match only. |

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

To filter worlds that have **all** specified tags, use comma-separated values or repeat the `tag` parameter:

```
GET /api/worlds?tag=horror,game
GET /api/worlds?tag=horror&tag=game
```

**Filtering by platforms**

To filter worlds that support **all** specified platforms, use comma-separated values or repeat the `platform` parameter:

```
GET /api/worlds?platform=standalonewindows,android
GET /api/worlds?platform=standalonewindows&platform=android
GET /api/worlds?platform=standalonewindows&platform=android&platform=ios
```

**Filtering by quality**

```
GET /api/worlds?quality=good
GET /api/worlds?quality=bad
GET /api/worlds?quality=good&quality=bad
```

**Filtering by capacity**

Filter worlds by maximum player capacity using an inclusive range. VRChat worlds currently support 1–80 players. Worlds with an unknown (`null`) capacity are excluded whenever a capacity filter is active.

```
GET /api/worlds?minCapacity=10
GET /api/worlds?maxCapacity=40
GET /api/worlds?minCapacity=10&maxCapacity=40
```

Validation rules:

- `minCapacity` and `maxCapacity` must be integers.
- `minCapacity` must be at least `1`.
- `maxCapacity` must be at most `80`.
- `minCapacity` must be less than or equal to `maxCapacity` when both are provided.
- Invalid values result in a **400 Bad Request**.

**Filtering by world ID**

To fetch only specific worlds by their exact VRChat world ID, use comma-separated values or repeat the `worldId` parameter:

```
GET /api/worlds?worldId=wrld_abc123
GET /api/worlds?worldId=wrld_abc123,wrld_def456
GET /api/worlds?worldId=wrld_abc123&worldId=wrld_def456
```

This is useful for batch lookups when you already have a list of world IDs.

**Combining filters**

Tag, platform, quality, search, and capacity filters work together with AND logic:

```
GET /api/worlds?minCapacity=10&maxCapacity=40&quality=good&tag=horror&platform=android
```

**Pagination**

Use `limit` and `offset` to page through results. Each response includes the `total` count so you can calculate the number of pages:

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

| Parameter | Type   | Description |
|-----------|--------|-------------|
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
    { "tag": "social",  "count": 512 },
    { "tag": "hangout", "count": 320 },
    { "tag": "game",    "count": 180 },
    { "tag": "avatar",  "count": 95 }
  ]
}
```

| Field   | Type   | Description |
|---------|--------|-------------|
| `tag`   | string | The tag value. |
| `count` | number | Number of world records using this tag. |

---

## World Record Schema

Each world object returned by the API has the following fields:

| Field         | Type                     | Description |
|---------------|--------------------------|-------------|
| `worldId`     | string                   | VRChat world ID (e.g. `wrld_abc123`). |
| `name`        | string \| null           | Display name of the world. |
| `authorName`  | string \| null           | Name of the author / creator. |
| `capacity`    | number \| null           | Maximum player capacity. |
| `platforms`   | string[]                 | Supported platforms (`android`, `standalonewindows`, etc.). |
| `tags`        | string[]                 | Tags applied to this world record. |
| `imageUrl`    | string \| null           | Thumbnail image URL from VRChat API. |
| `vrchatUrl`   | string                   | Link to the world on the VRChat website. |
| `quality`     | `"good"` \| `"bad"` \| null | Manual quality rating (if set). |
| `createdAt`   | string \| undefined      | ISO 8601 timestamp of when the record was created. |

Internal fields such as `guildId`, `messageId`, `sourceContent`, and `vrchatData` are intentionally stripped from API responses.

---

## Error Responses

| Status Code | Meaning                  | Body |
|-------------|--------------------------|------|
| `400`       | Invalid query params     | `{ "error": "minCapacity must be an integer" }` |
| `401`       | Missing / invalid token  | `{ "error": "Unauthorized" }` |
| `403`       | Disallowed origin or IP  | `{ "error": "Forbidden" }` |
| `404`       | World not found          | `{ "error": "World not found" }` |

---

## Example Usage (cURL)

```bash
# Health check (no auth)
curl http://localhost:3000/api/health

# List first 20 worlds tagged "social"
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds?limit=20&tag=social"

# List worlds tagged both "horror" and "game", marked as "good"
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds?tag=horror,game&quality=good"

# List worlds with capacity between 10 and 40, marked as good
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds?minCapacity=10&maxCapacity=40&quality=good"

# Get a specific world
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds/wrld_abc123"

# Fetch multiple worlds by ID in one request
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds?worldId=wrld_abc123,wrld_def456"

# List all tags
curl -H "Authorization: Bearer my-token" \
  http://localhost:3000/api/tags
```

---

## Notes

- The API is **read-only**. There are no endpoints to create, update, or delete records.
- Filtering by multiple tags or platforms uses **AND** logic: only worlds with *all* specified values are returned.
- The `quality` field is set via Discord reactions (`👍` / `👎`) and reflects a manual rating applied to the world record.
- `createdAt` is returned as an ISO 8601 string (`new Date(timestamp * 1000).toISOString()`).
