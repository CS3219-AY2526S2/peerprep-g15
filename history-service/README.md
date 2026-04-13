# History Service

Stores coding attempt history and serves per-user attempt timelines.

## Base URL

- Local default: `http://localhost:3005`

## Environment Variables

Create a `.env` file in `history-service/`:

```env
PORT=3005
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=add-db-name
```

Required:
- `MONGO_URI`
- `MONGO_DB_NAME`

Optional:
- `PORT` (defaults to `3005`)

## Run

```bash
npm install
npm run dev
```

Build and run production mode:

```bash
npm run build
npm start
```

## API Endpoints

### 1) Health Check

- Method: `GET`
- Path: `/health`

Response:

```json
{
  "status": "ok",
  "service": "history-service"
}
```

### 2) Save Attempt

- Method: `POST`
- Path: `/save-attempt`
- Content-Type: `application/json`

Required body fields:
- `userId` (string)
- `language` (string)
- `code` (string)
- `passed` (boolean)

Optional body fields:
- `roomId` (string)
- `questionId` (string or number)
- `questionTitle` (string)
- `results` (array)
- `error` (string or null)
- `submittedAt` (ISO date string, number timestamp, or date)

Example request:

```json
{
  "userId": "u123",
  "roomId": "room-1",
  "questionId": "42",
  "questionTitle": "Two Sum",
  "language": "typescript",
  "code": "function twoSum(nums, target) { return [0,1]; }",
  "passed": true,
  "results": [
    {
      "input": [2, 7, 11, 15],
      "expected": [0, 1],
      "actual": [0, 1],
      "passed": true,
      "stderr": null,
      "compileOutput": null,
      "message": null,
      "status": "Accepted"
    }
  ],
  "submittedAt": "2026-04-13T08:00:00.000Z"
}
```

Success response (`201`):

```json
{
  "message": "Attempt saved successfully",
  "attempt": {
    "attemptId": "f8f4f1e8-7f39-4f3e-bc13-7fb5b87f7e9f",
    "userId": "u123",
    "roomId": "room-1",
    "questionId": "42",
    "questionTitle": "Two Sum",
    "language": "typescript",
    "code": "function twoSum(nums, target) { return [0,1]; }",
    "passed": true,
    "results": [],
    "error": null,
    "submittedAt": "2026-04-13T08:00:00.000Z",
    "_id": "..."
  }
}
```

Validation error (`400`):

```json
{
  "message": "userId, language, code, and passed are required"
}
```

### 3) Get User Attempt History

- Method: `GET`
- Path: `/users/:userId/attempts`
- Query params:
- `limit` (optional, integer, min 1, max 200, default 50)
- `skip` (optional, integer, min 0, default 0)

Example:

- `/users/u123/attempts`
- `/users/u123/attempts?limit=10&skip=20`

Success response (`200`):

```json
{
  "items": [
    {
      "_id": "...",
      "attemptId": "073e9d6f-b6d2-4487-8170-ae349bccad24",
      "userId": "u123",
      "roomId": "room-1",
      "questionId": "42",
      "questionTitle": "Two Sum",
      "language": "typescript",
      "code": "function twoSum(nums, target) { return [0,1]; }",
      "passed": true,
      "results": [],
      "error": null,
      "submittedAt": "2026-04-13T08:26:49.776Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "skip": 0
}
```

Validation error (`400`):

```json
{
  "message": "userId is required"
}
```

## Manual API Test

Runs end-to-end save and retrieval checks against your configured MongoDB:

```bash
npm run test:manual
```

Make sure `.env` has valid `MONGO_URI` and `MONGO_DB_NAME` first.
