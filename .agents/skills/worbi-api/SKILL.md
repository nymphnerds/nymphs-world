---
name: worbi-api
description: WORBI API surface reference - all endpoint tables (auth, files, tags, LLM, settings, reminders, timeline, graph, images), auth flow, and token management
---

# WORBI Skill — API Surface Reference

Use this skill when working on **WORBI's backend or API integration** (routes, services, client API calls).

**Base URL:** `/api`
**Auth:** `Authorization: Bearer <JWT>` header on all protected routes
**Token storage:** `localStorage` key `wbu_token`
**Health check:** `GET /api/health` (public, no auth)

---

## 1. Auth Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `POST` | `/api/auth/login` | No | `{ username }` | `{ token, user }` |
| `POST` | `/api/auth/register` | No | `{ username }` | `{ token, user }` |

No password — username-only auth. `loginOrCreate()` auto-creates users.

---

## 2. File Endpoints

| Method | Path | Body / Query | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/files` | `?folder` | List files (optional folder filter) |
| `GET` | `/api/files/:fileId` | — | Get single file content |
| `POST` | `/api/files` | `{ name, type?, content?, folder? }` | Create file/folder |
| `PUT` | `/api/files/:fileId` | `{ name?, content?, folder? }` | Update file |
| `DELETE` | `/api/files/:fileId` | — | Delete file/folder |
| `POST` | `/api/files/upload` | `multipart/form-data` | Upload file |
| `POST` | `/api/files/upload-image` | `multipart/form-data` | Upload image to assets |
| `POST` | `/api/files/search` | `{ query }` | Full-text search |
| `POST` | `/api/files/star` | `{ fileId }` | Toggle star |
| `GET` | `/api/files/image/:imageName` | — | Serve image from assets |
| `PUT` | `/api/files/timeline/metadata` | `{ filePath, metadata }` | Persist timeline metadata |
| `GET` | `/api/files/timeline` | — | Get timeline entries grouped by era |
| `GET` | `/api/files/timeline/suggest-date` | `?era` | Suggest next date for era |

---

## 3. Tag Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/tags` | — | List all tags |
| `POST` | `/api/tags` | `{ name, color?, icon? }` | Create tag |
| `PUT` | `/api/tags/:tagId` | `{ name?, color?, icon? }` | Update tag |
| `DELETE` | `/api/tags/:tagId` | — | Delete tag |
| `POST` | `/api/tags/:fileId/assign` | `{ tagId }` | Assign tag to file |
| `DELETE` | `/api/tags/:fileId/unassign/:tagId` | — | Remove tag from file |
| `GET` | `/api/tags/relationships/:fileId` | — | Get file relationships |
| `POST` | `/api/tags/relationships` | `{ fromFileId, toFileId, type }` | Create relationship |
| `DELETE` | `/api/tags/relationships/:id` | — | Delete relationship |

---

## 4. LLM Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/llm/chat` | `{ messages[], model?, provider?, settings? }` | Chat completion with tool-calling |
| `POST` | `/api/llm/models` | — | Fetch available models |
| `POST` | `/api/llm/test` | `{ provider, url, key?, model? }` | Test LLM connection |

**Note:** All LLM connections are external and user-managed. WORBI no longer auto-detects local LLM servers or manages server lifecycle. The `POST /api/llm/detect` endpoint was removed in v6.2.52.

**AI Tools (7 total, in `toolService.js`):**
1. `read_file` — Read file from workspace
2. `write_file` — Write/create file in workspace
3. `list_files` — List workspace directory
4. `search_files` — Full-text search workspace
5. `read_tag` — Read tag metadata
6. `search_web` — DuckDuckGo search
7. `fetch_url` — Jina Reader URL fetch

Tool permissions controlled per-user in `config.js` → `defaultUserSettings.toolPermissions`.

---

## 5. Settings Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/settings` | — | Get user settings |
| `PUT` | `/api/settings` | `{ ...settings }` | Update user settings |

Settings stored as JSON in `server/data/user-settings/<username>-settings.json`.

---

## 6. Reminder Endpoints (`/api/reminders`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/reminders` | — | Get all reminders for user |
| `GET` | `/api/reminders/grouped` | — | Get reminders grouped by attached file |
| `POST` | `/api/reminders` | `{ title, fireAt, file?, recurrence?, ... }` | Create new reminder |
| `PUT` | `/api/reminders/:id` | `{ title?, fireAt?, ... }` | Update reminder |
| `POST` | `/api/reminders/:id/thread` | `{ note }` | Add thread note to reminder |
| `POST` | `/api/reminders/:id/convert` | `{ newFireAt }` | Convert fired reminder to new follow-up |
| `DELETE` | `/api/reminders/:id` | — | Delete reminder |
| `POST` | `/api/reminders/check` | — | Check for fired reminders + advance recurring |

---

## 7. Relationship Graph Endpoints (`/api/llm/graph/*`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/llm/graph/eras` | — | Get unique eras from timeline metadata |
| `POST` | `/api/llm/graph/from-seed` | `{ seedPath, relationshipTypes?, useAI?, depth? }` | Generate graph from seed document |

**Graph from-seed response:**
```json
{
  "nodes": [{ "id": "path.html", "label": "Name", "color": "#hex", "size": 18, "tags": [], "tagsMeta": [], "era": "", "date": "", "isSeed": false }],
  "edges": [{ "source": "path.html", "target": "path.html", "type": "character_connection", "label": "Desc", "strength": 3 }],
  "model": "seed-based (AI)",
  "fileCount": 5
}
```

**Relationship types:** `character_connection`, `location_connection`, `time_connection`, `thematic`, `narrative`, `tag_based`, `era_based`, `location_based`

---

## 8. Image Endpoints

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| `GET` | `/api/images/:imageName` | — | Serve image from user assets |
| `POST` | `/api/files/upload-image` | — | Upload image (multipart) |

---

## 9. Image Generation Endpoints (`/api/image-generation/*`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/image-generation/generate` | `{ prompt, ... }` | Generate image via Z-Image |
| `GET` | `/api/image-generation/status` | — | Get Z-Image server status |
| `POST` | `/api/image-generation/start` | — | Start Z-Image server |
| `POST` | `/api/image-generation/stop` | — | Stop Z-Image server |

---

## 10. Auth Flow

1. User enters username → `POST /api/auth/login`
2. Server calls `authService.loginOrCreate(username)`
3. Returns JWT token (7d expiry) + user info
4. Client stores token in `localStorage('wbu_token')`
5. All subsequent requests include `Authorization: Bearer <token>`
6. `authMiddleware.js` validates JWT on protected routes

---

## 11. Client API Types (`client/src/services/api.ts`)

Key TypeScript interfaces used by the frontend:
- `FileItem` — `{ _id, name, type, content, folder, starred, tags[], createdAt, updatedAt }`
- `Tag` — `{ _id, name, color, icon, fileCount, createdAt }`
- `FileRelationship` — `{ _id, fromFileId, toFileId, type, description, createdAt }`
- `LLMProvider` — `{ name, url, apiKey, model, type }`
- `UserSettings` — `{ llmProvider, llmModel, toolPermissions, theme, editor }`
- `ToolPermissions` — `{ [toolName]: boolean }`