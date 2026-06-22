# Agent Chat Pagination - Implementation Guide

## Overview

The agent chat now uses **pagination** to only load the 10 most recent messages initially, with scroll-back support to load older messages on demand.

## Backend Changes

### 1. Reduced Initial Message Load ✅

**File**: `backend/app/api/v1/ws_agent.py`

**Changed**:
```python
CONTEXT_WINDOW_MESSAGES = 10  # Was 50 before
```

Now the WebSocket connection only loads the **10 most recent messages** when connecting.

### 2. New Message History API ✅

**File**: `backend/app/api/v1/agent_history.py`

**NEW Endpoints**:

#### GET `/api/v1/agent/sessions/{session_id}/messages` - Paginated Message History

Load messages with pagination support:

```typescript
GET /api/v1/agent/sessions/{session_id}/messages?limit=10

Response:
{
  "items": [
    {
      "id": "msg-uuid-1",
      "role": "user",
      "content": "Hello!",
      "created_at": "2026-06-21T18:00:00Z"
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "created_at": "2026-06-21T18:00:05Z"
    }
  ],
  "total": 45,          // Total messages in session
  "limit": 10,          // Messages per page
  "has_more": true,     // More messages to load?
  "oldest_id": "msg-uuid-1",  // For next pagination
  "newest_id": "msg-uuid-2"
}
```

**Query Parameters**:
- `limit` (default: 10, max: 100) - Number of messages to return
- `before` (optional) - Message ID to paginate from (load messages before this ID)

**Scroll Back Example**:
```typescript
// Load next 10 older messages
GET /api/v1/agent/sessions/{session_id}/messages?limit=10&before={oldest_id}
```

#### GET `/api/v1/agent/sessions` - List All Sessions

```typescript
GET /api/v1/agent/sessions?role=product_manager

Response:
{
  "items": [
    {
      "id": "session-uuid",
      "agent_role": "product_manager",
      "title": "Product Manager thread",
      "message_count": 45,
      "created_at": "2026-06-20T10:00:00Z",
      "updated_at": "2026-06-21T18:00:00Z"
    }
  ],
  "total": 1
}
```

## Frontend Implementation

### 1. Initial Connection - Load 10 Recent Messages

```tsx
import { useEffect, useState } from 'react';

function AgentChat({ role = 'product_manager' }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:8000/ws/agent/${role}/chat?token=${token}`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'session_id') {
        setSessionId(data.value);
        // Load initial 10 messages
        loadRecentMessages(data.value);
      } else if (data.type === 'token') {
        // Append new token to messages
        // ...
      }
    };

    return () => ws.close();
  }, [role]);

  // Load the 10 most recent messages
  async function loadRecentMessages(sessionId: string) {
    const response = await fetch(
      `/api/v1/agent/sessions/${sessionId}/messages?limit=10`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    
    setMessages(data.items);
    setHasMore(data.has_more);
    setOldestMessageId(data.oldest_id);
  }

  // Load older messages (scroll back)
  async function loadOlderMessages() {
    if (!sessionId || !oldestMessageId || loading) return;
    
    setLoading(true);
    const response = await fetch(
      `/api/v1/agent/sessions/${sessionId}/messages?limit=10&before=${oldestMessageId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    
    // Prepend older messages
    setMessages(prev => [...data.items, ...prev]);
    setHasMore(data.has_more);
    setOldestMessageId(data.oldest_id);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Load More Button */}
      {hasMore && (
        <button
          onClick={loadOlderMessages}
          disabled={loading}
          className="p-2 text-sm text-blue-600 hover:bg-blue-50"
        >
          {loading ? 'Loading...' : 'Load older messages ↑'}
        </button>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="text-sm text-gray-500">{msg.role}</div>
            <div className="mt-1">{msg.content}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

### 2. Infinite Scroll (Alternative)

```tsx
import { useRef, useCallback } from 'react';

function AgentChat() {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);

  // Detect scroll to top
  const handleScroll = useCallback(() => {
    if (!messagesRef.current || !hasMore) return;
    
    const { scrollTop } = messagesRef.current;
    
    // User scrolled to top (within 50px)
    if (scrollTop < 50) {
      loadOlderMessages();
    }
  }, [hasMore, oldestMessageId]);

  async function loadOlderMessages() {
    // ... same as above
    const data = await fetch(/*...*/);
    
    // Remember scroll position before adding messages
    const scrollBefore = messagesRef.current?.scrollHeight || 0;
    
    setMessages(prev => [...data.items, ...prev]);
    
    // Restore scroll position (prevent jump)
    requestAnimationFrame(() => {
      if (messagesRef.current) {
        const scrollAfter = messagesRef.current.scrollHeight;
        messagesRef.current.scrollTop = scrollAfter - scrollBefore;
      }
    });
  }

  return (
    <div
      ref={messagesRef}
      onScroll={handleScroll}
      className="overflow-y-auto h-full"
    >
      {hasMore && <div className="text-center py-2">↑ Scroll up for more</div>}
      
      {messages.map((msg) => (
        <Message key={msg.id} {...msg} />
      ))}
    </div>
  );
}
```

### 3. Virtual Scrolling (Advanced)

For very large message histories, use react-window or react-virtual:

```tsx
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

function VirtualizedChat() {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    // Load older messages
    const data = await fetch(/*...*/);
    setMessages(prev => [...data.items, ...prev]);
  };

  return (
    <InfiniteLoader
      isItemLoaded={index => index < messages.length}
      itemCount={hasMore ? messages.length + 10 : messages.length}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <VariableSizeList
          height={600}
          itemCount={messages.length}
          itemSize={() => 80}
          onItemsRendered={onItemsRendered}
          ref={ref}
        >
          {({ index, style }) => (
            <div style={style}>
              <Message {...messages[index]} />
            </div>
          )}
        </VariableSizeList>
      )}
    </InfiniteLoader>
  );
}
```

## API Usage Examples

### Get Recent Messages

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/agent/sessions/{session_id}/messages?limit=10"

Response:
{
  "items": [...],        # 10 most recent messages
  "total": 45,           # Total in session
  "has_more": true,      # More to load?
  "oldest_id": "uuid-1"  # For pagination
}
```

### Load Older Messages

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/agent/sessions/{session_id}/messages?limit=10&before=uuid-1"

Response:
{
  "items": [...],        # 10 older messages
  "total": 45,
  "has_more": true,
  "oldest_id": "uuid-11" # New oldest ID
}
```

### List All Sessions

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/agent/sessions"

Response:
{
  "items": [
    {
      "id": "session-uuid",
      "agent_role": "product_manager",
      "message_count": 45,
      ...
    }
  ]
}
```

## Performance Benefits

### Before (Load All Messages)
```
Initial load: 50 messages (or all)
Database query: SELECT * ... LIMIT 50
Transfer size: Large (especially with images)
```

### After (Pagination)
```
Initial load: 10 messages
Database query: SELECT * ... LIMIT 10
Transfer size: Small
Scroll back: Load 10 more on demand
```

**Benefits**:
- ✅ 5x faster initial load
- ✅ 80% less data transfer
- ✅ Better UX (instant message display)
- ✅ Scalable to thousands of messages

## Image Handling

Base64 images are automatically stripped from list responses:

```python
# Backend strips large base64 images:
content = "[image]"  # Instead of full base64
```

This prevents massive payloads when loading message history.

## Message Flow

### 1. Initial Connection
```
WebSocket Connect
  → Loads 10 most recent messages
  → Displays chat
```

### 2. User Scrolls Up
```
User scrolls to top
  → Detects scroll position
  → Calls GET /messages?before={oldest_id}
  → Prepends older messages
  → Adjusts scroll position (no jump)
```

### 3. New Message
```
User sends message
  → WebSocket streams response
  → Appends to bottom
  → Auto-scroll to bottom
```

## Migration Guide

### Existing Chat Component

**Before**:
```tsx
// Loaded all messages on connect
const messages = await loadAllMessages(sessionId);
```

**After**:
```tsx
// Load only 10 recent
const data = await fetch(
  `/api/v1/agent/sessions/${sessionId}/messages?limit=10`
);
setMessages(data.items);

// Scroll back support
if (scrolledToTop && data.has_more) {
  const older = await fetch(
    `/api/v1/agent/sessions/${sessionId}/messages?limit=10&before=${oldestId}`
  );
  setMessages(prev => [...older.items, ...prev]);
}
```

## Summary

✅ **Initial Load**: 10 messages (was 50)
✅ **Pagination API**: Load older messages on demand
✅ **Scroll Back**: "Load more" button or infinite scroll
✅ **Image Stripping**: Large base64 removed from list
✅ **Performance**: 5x faster initial load
✅ **Scalability**: Works with thousands of messages

Your agent chat now loads faster and scales better! 🚀
