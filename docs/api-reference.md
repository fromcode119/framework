# API Reference

The Fromcode Framework provides a comprehensive REST and GraphQL API for interacting with system resources and plugin data.

## Authentication

Most endpoints require authentication via a JWT token.

- **Login**: `POST /api/v1/auth/login`
  ```json
  { "email": "admin@example.com", "password": "..." }
  ```
- **Token Usage**: Include the token in the `Authorization` header.
  ```text
  Authorization: Bearer <token>
  ```
- **Cookie Usage**: The Admin panel uses the platform auth session cookie for session management.

## Collections API

Every collection (e.g., `posts`, `products`) automatically receives CRUD endpoints.

### List Records
`GET /api/v1/collections/:slug`

**Query Parameters:**
- `limit`: Number of records to return (default: 10)
- `offset`: Number of records to skip (default: 0)
- `sort`: Field to sort by (prefix with `-` for descending)
- `where`: JSON filter object (e.g., `{"status": "published"}`)

### Get Record
`GET /api/v1/collections/:slug/:id`

### Create Record
`POST /api/v1/collections/:slug`

### Update Record
`PATCH /api/v1/collections/:slug/:id`

### Delete Record
`DELETE /api/v1/collections/:slug/:id`

## System Endpoints

### Health Check
`GET /api/health`
Returns system status, version, and maintenance mode state.

### System Metadata
`GET /api/v1/system/metadata`
Returns information about registered plugins, themes, and capabilities.

### User Status
`GET /api/v1/auth/status`
Returns details of the currently authenticated user.

## GraphQL API

Enabled by default at `/api/v1/graphql`.

The GraphQL schema is automatically generated based on your collection definitions. You can browse the schema and test queries using the built-in Voyager or GraphQL Playground (if enabled in development).

## API Versioning

The framework supports versioned APIs via the URL prefix:
- CURRENT: `/api/v1`
- LEGACY: `/api/collections` (deprecated)

## Realtime API (WebSockets)

The framework includes a built-in WebSocket server for real-time updates.

- **Endpoint**: `ws://your-host/api/ws`
- **Authentication**: Include your JWT in the `Sec-WebSocket-Protocol` header or via a one-time ticket.

### Standard Events
The system automatically broadcasts the following events:
- `system:hmr:reload`: Triggered when a plugin UI or backend is updated.
- `collection:<slug>:created`: Triggered after a record is created.
- `collection:<slug>:updated`: Triggered after a record is updated.
- `collection:<slug>:deleted`: Triggered after a record is deleted.

### Sending Messages
Plugins can register handlers for incoming socket messages:
```typescript
context.hooks.on('socket:message:my-plugin:action', ({ ws, payload }) => {
  ws.send(JSON.stringify({ type: 'response', payload: 'Action received!' }));
});
```

## Management Services

### System Update Service
Used to check and apply updates to the Fromcode Core.
- **Service**: `SystemUpdateService` (available in `@fromcode119/core`)
- **Key Methods**:
    - `checkUpdate()`: Compares current `package.json` version with the Marketplace Hub.
    - `applyUpdate()`: Downloads latest ZIP, creates a system backup, and overwrites changed files.

### Hot Reload Service
Enables development without manual restarts.
- **Service**: `HotReloadService`
- **Behavior**: Watches the `plugins/` directory. When a file changes, it emits a `system:hmr:reload` event via WebSockets and triggers internal re-registration hooks.

## Global Webhooks

You can register webhooks to receive real-time notifications for system events (e.g., `afterCreate`, `afterUpdate`). Webhooks are signed with an HMAC-SHA256 signature for security.
