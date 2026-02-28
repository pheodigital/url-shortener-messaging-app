# Manual Testing Guide — URL Shortener

> **Goal:** Verify Redis caching, RabbitMQ message flow, and all service integrations work end to end.

---

## Prerequisites

Start all services in separate terminals:

```bash
# Terminal 1
cd services/auth-service && npm run dev

# Terminal 2
cd services/url-service && npm run dev

# Terminal 3
cd services/analytics-worker && npm run dev

# Terminal 4
cd services/analytics-service && npm run dev
```

Verify all four are running:
```bash
curl http://localhost:3001/health  # auth-service
curl http://localhost:3002/health  # url-service
curl http://localhost:3003/health  # analytics-service
# analytics-worker has no /health — check terminal logs
```

Expected response from each:
```json
{ "status": "ok", "dependencies": { ... } }
```

---

## Tools You Will Need

- Browser (for Google OAuth login)
- curl or Postman
- MongoDB Atlas dashboard
- CloudAMQP dashboard
- Redis CLI or RedisInsight (optional but recommended)

---

## TC-01 — Authentication Flow

**What we are testing:** Google OAuth login, JWT issuance, token refresh, logout.

### Step 1 — Login with Google
```
Open browser: http://localhost:3001/auth/google
Complete Google OAuth flow
```

Expected response:
```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "...", "email": "...", "name": "..." }
  }
}
```

Save both tokens:
```bash
ACCESS_TOKEN="paste_accessToken_here"
REFRESH_TOKEN="paste_refreshToken_here"
```

### Step 2 — Verify /auth/me
```bash
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected:
```json
{ "status": "success", "data": { "id": "...", "email": "...", "name": "..." } }
```

### Step 3 — Refresh the access token
```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

Expected: new `accessToken` returned. Update your variable:
```bash
ACCESS_TOKEN="paste_new_accessToken_here"
```

### Step 4 — Logout
```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected: `{ "status": "success" }`

### Step 5 — Verify refresh token is revoked after logout
```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

Expected: `401 Refresh token has been revoked`

**Login again** to get fresh tokens before continuing:
```
http://localhost:3001/auth/google
```

---

## TC-02 — URL Management

**What we are testing:** Create, list, delete short URLs with ownership checks.

### Step 1 — Create a short URL
```bash
curl -X POST http://localhost:3002/api/urls \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://www.google.com"}'
```

Expected:
```json
{
  "status": "success",
  "data": {
    "id": "...",
    "shortcode": "Zgi-dpL",
    "shortUrl": "http://localhost:80/Zgi-dpL",
    "longUrl": "https://www.google.com",
    "createdAt": "..."
  }
}
```

Save the shortcode:
```bash
SHORTCODE="paste_shortcode_here"
```

### Step 2 — Create a URL with a custom code
```bash
curl -X POST http://localhost:3002/api/urls \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://www.github.com", "customCode": "mygithub"}'
```

Expected: `shortcode: "mygithub"`

### Step 3 — Try duplicate custom code
```bash
curl -X POST http://localhost:3002/api/urls \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://www.github.com", "customCode": "mygithub"}'
```

Expected: `409 Custom code already taken`

### Step 4 — List all URLs
```bash
curl http://localhost:3002/api/urls \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected: array of URLs belonging to this user only.

### Step 5 — Try without token
```bash
curl http://localhost:3002/api/urls
```

Expected: `401 No token provided`

### Step 6 — Delete a URL
```bash
curl -X DELETE http://localhost:3002/api/urls/$URL_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected: `{ "status": "success", "message": "URL deleted" }`

---

## TC-03 — Redis Cache in Action

**What we are testing:** Cache MISS on first redirect, cache HIT on second redirect.

### Step 1 — Create a fresh URL
```bash
curl -X POST http://localhost:3002/api/urls \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://www.example.com"}'
```

Save shortcode:
```bash
SHORTCODE="paste_new_shortcode_here"
```

### Step 2 — First redirect (Cache MISS)
```bash
curl -v http://localhost:3002/$SHORTCODE
```

Expected:
- Response: `302 → https://www.example.com`
- url-service terminal logs: `Redirect via database` ← **cache MISS confirmed**

### Step 3 — Second redirect (Cache HIT)
```bash
curl -v http://localhost:3002/$SHORTCODE
```

Expected:
- Response: `302 → https://www.example.com`
- url-service terminal logs: `Redirect via cache` ← **cache HIT confirmed**

### Step 4 — Verify key exists in Redis
```bash
# If you have Redis CLI
redis-cli -u $REDIS_URL KEYS "cache:*"
redis-cli -u $REDIS_URL GET "cache:$SHORTCODE"
```

Expected: `https://www.example.com`

### Step 5 — Delete URL and verify cache is invalidated
```bash
curl -X DELETE http://localhost:3002/api/urls/$URL_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Then hit the shortcode again:
```bash
curl -v http://localhost:3002/$SHORTCODE
```

Expected: `410 Short URL has been deleted` — cache was invalidated on delete.

---

## TC-04 — RabbitMQ Click Events in Action

**What we are testing:** Every redirect publishes a click event to RabbitMQ, analytics-worker consumes it and stores in MongoDB.

### Step 1 — Check CloudAMQP dashboard before
```
Go to cloudamqp.com → your instance → RabbitMQ Manager
Queues → click_events → note current message count
```

### Step 2 — Trigger 5 redirects
```bash
for i in {1..5}; do
  curl -s -o /dev/null http://localhost:3002/$SHORTCODE
  echo "Redirect $i done"
done
```

### Step 3 — Watch analytics-worker terminal
Expected to see for each redirect:
```
[info] Click event received  { shortcode: "..." }
[info] Click event stored    { shortcode: "..." }
```

### Step 4 — Check CloudAMQP dashboard after
```
Queues → click_events
Messages ready should be 0 (worker consumed them all)
Message rates graph should show a spike
```

### Step 5 — Verify in MongoDB Atlas
```
Go to mongodb.com/atlas → your cluster
Browse Collections → analytics → clickevents
```

Expected: 5 new documents with:
```json
{
  "shortcode": "...",
  "longUrl": "https://www.example.com",
  "timestamp": "...",
  "ip": "::1",
  "userAgent": "curl/8.7.1"
}
```

---

## TC-05 — Analytics Stats Endpoints

**What we are testing:** Stats are correctly aggregated from MongoDB click events.

### Step 1 — Get stats for a shortcode
```bash
curl http://localhost:3003/api/stats/$SHORTCODE
```

Expected:
```json
{
  "status": "success",
  "data": {
    "shortcode": "...",
    "totalClicks": 5,
    "clicksToday": 5,
    "clicksThisWeek": 5,
    "topUserAgents": [
      { "userAgent": "curl/8.7.1", "count": 5 }
    ]
  }
}
```

### Step 2 — Trigger more redirects and verify count increases
```bash
curl -s -o /dev/null http://localhost:3002/$SHORTCODE
curl http://localhost:3003/api/stats/$SHORTCODE
```

Expected: `totalClicks` incremented by 1.

### Step 3 — Get summary stats (requires auth)
```bash
curl http://localhost:3003/api/stats/summary \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected:
```json
{
  "status": "success",
  "data": {
    "totalClicks": 6,
    "totalUrls": 2,
    "clicksToday": 6,
    "topShortcodes": [...]
  }
}
```

### Step 4 — Try summary without token
```bash
curl http://localhost:3003/api/stats/summary
```

Expected: `401 No token provided`

---

## TC-06 — Rate Limiting

**What we are testing:** 429 is returned after exceeding the rate limit.

### Step 1 — Spam the redirect endpoint
```bash
for i in {1..305}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/$SHORTCODE)
  echo "Request $i: $STATUS"
done
```

Expected:
- Requests 1–300: `302`
- Requests 301+: `429`

### Step 2 — Check 429 response body
```bash
curl -v http://localhost:3002/$SHORTCODE  # after limit exceeded
```

Expected:
```json
{
  "status": "error",
  "message": "Too many requests — please slow down"
}
```

And response headers:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
Retry-After: <seconds>
```

### Step 3 — Wait for window to reset
```bash
sleep 60
curl -v http://localhost:3002/$SHORTCODE
```

Expected: `302` again — rate limit window has reset.

---

## TC-07 — Health Checks

**What we are testing:** All services report healthy dependencies.

```bash
# url-service — postgres + redis + rabbitmq
curl http://localhost:3002/health | jq

# auth-service — postgres
curl http://localhost:3001/health | jq

# analytics-service — mongodb
curl http://localhost:3003/health | jq
```

Expected for each:
```json
{
  "status": "ok",
  "service": "...",
  "timestamp": "...",
  "dependencies": {
    "postgres": "ok",   // url-service + auth-service
    "redis": "ok",      // url-service
    "rabbitmq": "ok",   // url-service
    "mongodb": "ok"     // analytics-service
  }
}
```

---

## TC-08 — Error Handling

**What we are testing:** Proper error responses for invalid inputs.

### Invalid URL
```bash
curl -X POST http://localhost:3002/api/urls \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "not-a-url"}'
```
Expected: `400 Validation failed`

### Non-existent shortcode
```bash
curl http://localhost:3002/doesnotexist123
```
Expected: `404 Short URL not found`

### Deleted shortcode
```bash
# After deleting a URL
curl http://localhost:3002/$DELETED_SHORTCODE
```
Expected: `410 Short URL has been deleted`

### Invalid token
```bash
curl http://localhost:3002/api/urls \
  -H "Authorization: Bearer invalid.token.here"
```
Expected: `401 Invalid or expired token`

---

## Test Results Checklist

| Test Case | Description | Expected | Pass/Fail |
|-----------|-------------|----------|-----------|
| TC-01-1 | Google OAuth login | accessToken + refreshToken returned | |
| TC-01-2 | /auth/me with valid token | User details returned | |
| TC-01-3 | Refresh access token | New accessToken returned | |
| TC-01-4 | Logout | Success | |
| TC-01-5 | Refresh after logout | 401 revoked | |
| TC-02-1 | Create short URL | 201 with shortcode | |
| TC-02-2 | Create with custom code | shortcode matches customCode | |
| TC-02-3 | Duplicate custom code | 409 | |
| TC-02-4 | List URLs | Only user's URLs returned | |
| TC-02-5 | List without token | 401 | |
| TC-02-6 | Delete URL | 200 | |
| TC-03-1 | First redirect | 302 + cache MISS log | |
| TC-03-2 | Second redirect | 302 + cache HIT log | |
| TC-03-3 | Redis key exists | Key found in Redis | |
| TC-03-4 | Delete URL invalidates cache | 410 after delete | |
| TC-04-1 | Redirect publishes event | analytics-worker logs stored | |
| TC-04-2 | CloudAMQP messages consumed | Queue empty after worker runs | |
| TC-04-3 | MongoDB has click documents | Documents visible in Atlas | |
| TC-05-1 | Stats for shortcode | totalClicks matches redirects | |
| TC-05-2 | Stats count increases | Increments after new redirect | |
| TC-05-3 | Summary with auth | Aggregate stats returned | |
| TC-05-4 | Summary without auth | 401 | |
| TC-06-1 | Rate limit redirect | 429 after 300 requests | |
| TC-06-2 | Retry-After header | Header present on 429 | |
| TC-06-3 | Rate limit resets | 302 after 60 seconds | |
| TC-07-1 | url-service health | All dependencies ok | |
| TC-07-2 | auth-service health | postgres ok | |
| TC-07-3 | analytics-service health | mongodb ok | |
| TC-08-1 | Invalid URL | 400 validation error | |
| TC-08-2 | Non-existent shortcode | 404 | |
| TC-08-3 | Deleted shortcode | 410 | |
| TC-08-4 | Invalid token | 401 | |
