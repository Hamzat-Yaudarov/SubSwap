# API Reference - Wormz Bot

Complete API documentation for the Wormz Bot + MiniApp backend.

**Base URL**: `/api`
**Content-Type**: `application/json`

---

## Authentication

All endpoints require the `X-Init-Data` header with Telegram WebApp data:
```
X-Init-Data: <telegram_init_data>
```

The WebApp automatically sends this data for all requests.

---

## Authentication Endpoints

### 1. POST `/auth`

Authenticate user with Telegram WebApp data.

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 123456789,
    "rating": 100,
    "created_at": "2024-01-15T10:30:00Z",
    "is_banned": false
  }
}
```

**Errors**:
- 401: Invalid or missing init data
- 500: Authentication failed

---

### 2. GET `/profile`

Get user profile with statistics.

**Response** (200 OK):
```json
{
  "user": {
    "id": 123456789,
    "rating": 102,
    "created_at": "2024-01-15T10:30:00Z",
    "is_banned": false,
    "channels_count": 3,
    "completed_mutuals": 5,
    "active_mutuals": 2
  },
  "recent_mutuals": [
    {
      "id": 1,
      "title": "Crypto News",
      "mutual_type": "subscribe",
      "status": "completed",
      "created_at": "2024-01-20T15:30:00Z"
    }
  ]
}
```

---

### 3. PATCH `/profile`

Update user profile.

**Request**:
```json
{
  "rating": 105
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 123456789,
    "rating": 105,
    "updated_at": "2024-01-21T10:30:00Z"
  }
}
```

---

## Channel Endpoints

### 1. POST `/channels/add`

Add a new channel or chat.

**Request**:
```json
{
  "link": "https://t.me/mychannel",
  "type": "channel"
}
```

**Fields**:
- `link` (required): Telegram channel/chat link (t.me/...)
- `type` (required): `"channel"` or `"chat"`

**Response** (200 OK):
```json
{
  "success": true,
  "channel": {
    "id": 1,
    "title": "My Channel",
    "type": "channel",
    "members_count": 1000,
    "rating": 0,
    "created_at": "2024-01-21T10:30:00Z"
  }
}
```

**Errors**:
- 400: Invalid link format or already exists
- 403: User not admin or is banned
- 404: Channel not found or bot not admin
- 500: Failed to add channel

---

### 2. GET `/channels`

Get user's channels.

**Response** (200 OK):
```json
{
  "channels": [
    {
      "id": 1,
      "title": "My Channel",
      "type": "channel",
      "members_count": 1000,
      "rating": 0,
      "is_active": true,
      "created_at": "2024-01-21T10:30:00Z"
    }
  ]
}
```

---

### 3. GET `/channels/:id`

Get specific channel details.

**Response** (200 OK):
```json
{
  "channel": {
    "id": 1,
    "owner_id": 123456789,
    "tg_id": 1234567890,
    "title": "My Channel",
    "type": "channel",
    "members_count": 1000,
    "rating": 0,
    "is_active": true,
    "created_at": "2024-01-21T10:30:00Z",
    "updated_at": "2024-01-21T10:30:00Z"
  }
}
```

**Errors**:
- 404: Channel not found

---

### 4. DELETE `/channels/:id`

Delete a channel.

**Response** (200 OK):
```json
{
  "success": true
}
```

**Errors**:
- 403: Can only delete own channels
- 404: Channel not found

---

## Mutual Endpoints

### 1. POST `/mutuals/create`

Create a new mutual subscription or reaction task.

**Request**:
```json
{
  "channel_id": 1,
  "mutual_type": "subscribe",
  "required_count": 1,
  "hold_hours": 24
}
```

**Fields**:
- `channel_id` (required): ID of your channel
- `mutual_type` (required): `"subscribe"` or `"reaction"`
- `required_count` (optional): Number of actions required (default: 1)
- `hold_hours` (optional): Duration to hold subscription (default: 24)

**Response** (200 OK):
```json
{
  "success": true,
  "mutual": {
    "id": 1,
    "channel_id": 1,
    "mutual_type": "subscribe",
    "required_count": 1,
    "hold_hours": 24,
    "status": "active",
    "created_at": "2024-01-21T10:30:00Z"
  }
}
```

**Errors**:
- 400: Invalid mutual type or missing fields
- 403: User banned, low rating, or not channel owner
- 404: Channel not found or inactive

---

### 2. GET `/mutuals`

Get user's created mutuals.

**Response** (200 OK):
```json
{
  "mutuals": [
    {
      "id": 1,
      "channel_id": 1,
      "mutual_type": "subscribe",
      "required_count": 1,
      "hold_hours": 24,
      "status": "active",
      "created_at": "2024-01-21T10:30:00Z",
      "title": "My Channel",
      "members_count": 1000,
      "creator_rating": 102
    }
  ]
}
```

---

### 3. GET `/mutuals/available`

Get available mutuals to join (filtered by type).

**Query Parameters**:
- `mutual_type` (optional): `"subscribe"` or `"reaction"`

**Response** (200 OK):
```json
{
  "mutuals": [
    {
      "id": 2,
      "channel_id": 2,
      "mutual_type": "subscribe",
      "required_count": 1,
      "hold_hours": 24,
      "status": "active",
      "created_at": "2024-01-21T10:30:00Z",
      "title": "Other Channel",
      "channel_type": "channel",
      "members_count": 500,
      "creator_rating": 98
    }
  ]
}
```

**Errors**:
- 403: User rating too low (< 60)

---

### 4. GET `/mutuals/:id`

Get specific mutual details.

**Response** (200 OK):
```json
{
  "mutual": {
    "id": 1,
    "creator_id": 123456789,
    "channel_id": 1,
    "mutual_type": "subscribe",
    "required_count": 1,
    "hold_hours": 24,
    "status": "active",
    "created_at": "2024-01-21T10:30:00Z",
    "title": "My Channel",
    "channel_type": "channel",
    "members_count": 1000,
    "creator_rating": 102
  }
}
```

---

### 5. POST `/mutuals/:id/join`

Join a mutual (start task).

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "action": {
    "id": 1,
    "mutual_id": 1,
    "status": "pending",
    "created_at": "2024-01-21T10:30:00Z"
  }
}
```

**Errors**:
- 400: Already participating or mutual inactive
- 403: User rating too low
- 404: Mutual not found

---

### 6. POST `/mutuals/:id/check`

Check if mutual is completed (verify subscription/reaction).

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Action verified",
  "new_rating": 104
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Action not verified"
}
```

---

## Chat Endpoints

### 1. POST `/chat/post`

Create a chat post (request for mutual).

**Request**:
```json
{
  "channel_id": 1,
  "post_type": "channel",
  "conditions": "до 500 подписчиков"
}
```

**Fields**:
- `channel_id` (required): Your channel ID
- `post_type` (required): `"channel"`, `"chat"`, or `"reaction"`
- `conditions` (optional): Additional requirements

**Response** (200 OK):
```json
{
  "success": true,
  "post": {
    "id": 1,
    "channel_id": 1,
    "post_type": "channel",
    "conditions": "до 500 подписчиков",
    "created_at": "2024-01-21T10:30:00Z",
    "expires_at": "2024-01-22T10:30:00Z"
  }
}
```

**Errors**:
- 400: Invalid post type or missing fields
- 403: User rating too low (< 80) or is banned
- 404: Channel not found or inactive
- 429: Daily limit reached (3 posts) or cooldown active

---

### 2. GET `/chat/posts`

Get chat posts.

**Query Parameters**:
- `post_type` (optional): `"channel"`, `"chat"`, or `"reaction"`

**Response** (200 OK):
```json
{
  "posts": [
    {
      "id": 1,
      "user_id": 987654321,
      "channel_id": 2,
      "post_type": "channel",
      "conditions": "до 500",
      "created_at": "2024-01-21T10:30:00Z",
      "expires_at": "2024-01-22T10:30:00Z",
      "channel_title": "Other Channel",
      "members_count": 500,
      "creator_rating": 98,
      "time_ago": "5м назад"
    }
  ]
}
```

---

### 3. POST `/chat/:postId/respond`

Respond to a chat post (start mutual from post).

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "mutual_id": 5
}
```

**Errors**:
- 404: Post not found or expired
- 400: Already responded

---

### 4. DELETE `/chat/:postId`

Delete a chat post.

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Errors**:
- 403: Can only delete own posts
- 404: Post not found

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message"
}
```

**Common Status Codes**:
- `200` - Success
- `400` - Bad request (validation error)
- `401` - Unauthorized (invalid auth)
- `403` - Forbidden (no permission)
- `404` - Not found
- `429` - Too many requests (rate limit)
- `500` - Server error

---

## Rate Limits

- Chat posts: 3 per day per user
- Chat re-post: 1 hour cooldown
- Post lifetime: 24 hours

---

## Response Format

All successful responses include:
- Response data (varies by endpoint)
- Status code 200 or 201

All error responses include:
- `error` field with error message
- Appropriate HTTP status code

---

## WebApp Integration

The MiniApp automatically sends `X-Init-Data` header with all requests:

```javascript
const api = {
  async request(method, endpoint, data = null) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Init-Data': window.Telegram?.WebApp?.initData || ''
    };
    // ... rest of implementation
  }
};
```

---

## Example Usage

### Adding a Channel
```bash
curl -X POST http://localhost:8080/api/channels/add \
  -H "Content-Type: application/json" \
  -H "X-Init-Data: <telegram_init_data>" \
  -d '{
    "link": "https://t.me/mychannel",
    "type": "channel"
  }'
```

### Creating a Mutual
```bash
curl -X POST http://localhost:8080/api/mutuals/create \
  -H "Content-Type: application/json" \
  -H "X-Init-Data: <telegram_init_data>" \
  -d '{
    "channel_id": 1,
    "mutual_type": "subscribe",
    "required_count": 1,
    "hold_hours": 24
  }'
```

### Getting Profile
```bash
curl -X GET http://localhost:8080/api/profile \
  -H "X-Init-Data: <telegram_init_data>"
```

---

## Best Practices

1. ✅ Always include `X-Init-Data` header
2. ✅ Validate responses for errors
3. ✅ Handle rate limit errors gracefully
4. ✅ Use appropriate HTTP methods (POST, GET, DELETE)
5. ✅ Send JSON content-type header
6. ✅ Parse JSON responses
7. ✅ Show user-friendly error messages

---

**API Version**: 1.0  
**Last Updated**: January 2024
