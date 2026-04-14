# Matching Service

The matching service owns the MongoDB-backed queue used to pair users by topic and difficulty. It verifies the caller through `user-service` before allowing queue operations.

## What it does

- Accepts authenticated join and leave requests.
- Tracks queue status for each user in MongoDB.
- Produces a match when a compatible waiting user is found and stores it in MongoDB.
- Retrieves a random question for each new match using the resolved match topic and difficulty.
- Exposes a queue snapshot for debugging and admin-style inspection.
- Resolves access tokens through `user-service` instead of verifying JWTs locally.

## Environment Variables

The service reads these variables from the environment:

- `PORT` - HTTP port, defaults to `3003`.
- `MONGO_URI` - MongoDB connection string.
- `MONGO_DB_NAME` - MongoDB database name.
- `USER_SERVICE_URL` - Base URL for `user-service`, defaults to `http://localhost:3001`.
- `QUESTION_SERVICE_URL` - Base URL for `question-service`, defaults to `http://localhost:3002`.
- `INTERNAL_SERVICE_TOKEN` - Shared token used to call `user-service` internal auth endpoints.

## Run Commands

From the `matching-service` folder:

```bash
npm run dev
npm run test:api
```

## API Routes

All routes are mounted under `/matching`.

### Health Check

`GET /matching/health` - Health check.

Use this for uptime checks or container health probes. No auth header is required.

Example:

```bash
curl http://localhost:3003/matching/health
```

Response:

```json
{
    "status": "ok",
    "service": "matching-service"
}
```

### Join

`POST /matching/join` - Join the queue or return a match.

Use this when a user clicks "find match" or when the frontend wants to place the user into the matchmaking queue. The request must use the authenticated user's own `userId`.

Headers:

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>`

Body:

```json
{
    "userId": "user-123",
    "topic": "arrays",
    "difficulty": "easy"
}
```

Example:

```bash
curl -X POST http://localhost:3003/matching/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "userId": "user-123",
    "topic": "arrays",
    "difficulty": "easy"
  }'
```

Responses:

- `200 OK` when a compatible user is found immediately.
- `202 Accepted` when the user is queued.
- `400 Bad Request` when required fields are missing or `difficulty` is invalid.
- `403 Forbidden` when the `userId` does not match the authenticated user.

Duplicate join behavior (idempotency):

- Re-sending `POST /matching/join` for a user that is already queued returns `202 Accepted` with the existing queue entry.
- Re-sending `POST /matching/join` for a user that is already matched returns `200 OK` with the existing match.
- The service does not create duplicate queue entries for the same user and does not allow self-match (`userId` matched to itself).

### Leave

`POST /matching/leave` - Remove a user from the queue.

Use this when the user cancels matchmaking and should no longer wait in the queue.

Headers:

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>`

Body:

```json
{
    "userId": "user-123"
}
```

Example:

```bash
curl -X POST http://localhost:3003/matching/leave \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"userId":"user-123"}'
```

Responses:

- `200 OK` when the user is removed from the queue.
- `400 Bad Request` when `userId` is missing.
- `403 Forbidden` when the `userId` does not match the authenticated user.
- `404 Not Found` when the user is not currently queued.

### End

`POST /matching/end` - End a match.

Use this when the match session is complete and should be marked as ended. After this call, the status for both users in the match becomes `not_found` because they are no longer queued or actively matched.

Headers:

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>`

Body:

```json
{
    "matchId": "match-uuid-123"
}
```

Example:

```bash
curl -X POST http://localhost:3003/matching/end \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"matchId":"match-uuid-123"}'
```

Responses:

- `200 OK` when the match is marked as ended.
- `400 Bad Request` when `matchId` is missing.
- `404 Not Found` when the match is not found.

### Status

`GET /matching/status/:userId` - Get queue status for a user.

Use this to check whether the authenticated user is queued, matched, timed out, or not found.

Path parameter:

- `userId` - Must match the authenticated user.

Example:

```bash
curl http://localhost:3003/matching/status/user-123 \
  -H "Authorization: Bearer <accessToken>"
```

Responses:

- `200 OK` with the current queue status payload.
- `400 Bad Request` when `userId` is missing.
- `403 Forbidden` when the `userId` does not match the authenticated user.

### Queue

`GET /matching/queue` - List all queued users.

Use this for debugging or admin-style inspection of the current queue snapshot.

Example:

```bash
curl http://localhost:3003/matching/queue \
  -H "Authorization: Bearer <accessToken>"
```

Response:

```json
{
    "queuedUsers": []
}
```

Routes except health are protected by `requireAuth`. The request `userId` must match the authenticated user returned by `user-service`.

## Function Reference

### App and Startup

- `createApp()` in `src/app.ts` creates the Express app, enables CORS and JSON parsing, registers routes, and installs the 404 and error handlers.
- `registerRoutes(app)` in `src/routes/index.ts` mounts the matching router under `/matching`.
- `start()` in `src/server.ts` connects to MongoDB, creates the app, and starts the HTTP server.
- `connectDB(uri, dbName)` in `src/config/db.ts` connects to MongoDB and throws if either value is missing.

### Environment and Configuration

- `config` in `src/config/env.ts` reads runtime settings such as `PORT`, `MONGO_URI`, `USER_SERVICE_URL`, and `INTERNAL_SERVICE_TOKEN`.

### Controllers

- `MatchingController.health()` returns a simple service status response for uptime checks.
- `MatchingController.join()` validates the request body, enforces auth identity matching, and either queues the user or returns a match.
- `MatchingController.leave()` validates the request body, enforces auth identity matching, and removes the user from the queue.
- `MatchingController.status()` returns the current queue state for the authenticated user.
- `MatchingController.queue()` returns the current queue snapshot.
- `getRequiredString()` is a small internal helper that trims and validates request fields before the controller uses them.

### Authentication

- `requireAuth()` in `src/middleware/auth-middleware.ts` checks the `Authorization: Bearer <token>` header, resolves the token through `user-service`, and attaches the authenticated user to the request.
- `getBearerToken()` is an internal helper that extracts the token from the authorization header.
- `resolveAuthUser(accessToken)` in `src/services/auth-service.ts` calls `user-service` at `/internal/auth/resolve` and converts the response into a validated user record.
- `setAuthServiceFetch()` lets tests replace the fetch implementation used by auth resolution.
- `AuthResolutionError` is the typed error used to map auth failures to HTTP responses.
- `parseResolvedUser()` is an internal helper that validates the auth response payload.

### Matching Logic

- `joinQueue(request, nowMs)` tries to match the joining user immediately, otherwise adds the user to the queue.
- `leaveQueue(userId)` removes a user from whichever queue they are in.
- `getQueueStatus(userId, nowMs)` returns `matched`, `queued`, `timed_out`, or `not_found` for a user.
- `listQueuedUsers(nowMs)` returns a flattened snapshot of all queued users.
- `resetMatchingState()` clears the active matching repository and is mainly used by tests.
- `setMatchingRepository(repository)` swaps the active repository implementation, which lets tests use an in-memory store.
- `createInMemoryMatchingRepository()` creates the in-memory repository used by tests.
- `pickBestWaitingUserIndex(queue, joiningUser, nowMs)` selects the best candidate from one queue using the stage and FIFO rules.

The internal helper functions below support the queue policy and are useful when reading or testing the matching behavior:

- `createCriteriaKey(topic, difficulty)` groups users into the same queue bucket.
- `getWaitedMs(entry, nowMs)` calculates how long a user has been waiting.
- `isTimedOut(entry, nowMs)` checks whether a user has exceeded the queue timeout.
- `purgeTimedOutEntries(nowMs)` removes timed-out users before matching or listing the queue.
- `getMatchStage(joiningUser, candidate, nowMs)` applies the matching policy: exact match, topic expansion, then FIFO fallback.
- `findQueuedUser(userId)` removes a specific queued user.
- `findBestWaitingCandidate(joiningUser, nowMs)` searches all queues for the best eligible match.

### Middleware

- `notFoundHandler()` returns a consistent 404 response for unknown routes.
- `errorHandler()` returns a 500 response using the thrown error message when available.

## Matching Policy

The queue uses staged matching:

- Stage 0: exact topic and difficulty match.
- Stage 1: topic match after the waiting user has been in queue for at least 15 seconds.
- Timeout: users are removed from consideration after 60 seconds.

If multiple candidates qualify, the service prefers the lowest stage first and then the longest-waiting user.

## Testing Notes

The production matching queue persists in MongoDB. Tests can still swap in an isolated in-memory repository with `setMatchingRepository(createInMemoryMatchingRepository())` when they need a clean slate without touching the live database.

## Notes

- The matching service does not verify JWTs locally.
- It depends on `user-service` to resolve the access token and user identity.
- `INTERNAL_SERVICE_TOKEN` must match the token configured in `user-service`.
