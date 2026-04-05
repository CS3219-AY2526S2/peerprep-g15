Absolutely — here’s a `README.md` tailored to your current `question-service`.

````md
# Question Service

The Question Service is responsible for storing and serving coding questions for PeerPrep.

It exposes endpoints for:

- listing questions
- retrieving a single question by ID
- creating new questions
- updating existing questions
- deleting questions

Questions are stored in MongoDB, and protected routes use the **User Service** as the source of truth for authentication and current role resolution.

---

## Features

- Retrieve all questions
- Filter questions by difficulty
- Filter questions by category
- Retrieve a single question by `questionId`
- Create a new question
- Update an existing question
- Delete a question
- Role-based access control for admin-only write operations
- Cross-service authentication via User Service internal auth resolution

---

## Tech Stack

- **Node.js**
- **Express**
- **TypeScript**
- **MongoDB + Mongoose**
- **dotenv**
- **CORS**

---

## Project Structure

```text
question-service/
├── src/
│   ├── config/
│   │   ├── db.ts
│   │   └── env.ts
│   ├── controllers/
│   │   └── question-controller.ts
│   ├── middleware/
│   │   ├── auth-middleware.ts
│   │   ├── error-middleware.ts
│   │   └── notFound-middleware.ts
│   ├── models/
│   │   └── question-model.ts
│   ├── routes/
│   │   ├── health-routes.ts
│   │   ├── index.ts
│   │   └── question-routes.ts
│   ├── utils/
│   ├── app.ts
│   └── server.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```
````

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a `.env` file

Use the following values as a starting point:

```env
PORT=3002
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=peerprep_question
USER_SERVICE_URL=http://localhost:3001
INTERNAL_SERVICE_TOKEN=your_internal_service_token
```

### 3. Run in development mode

```bash
npm run dev
```

### 4. Build and run production version

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable                 | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `PORT`                   | Port the Question Service runs on                           |
| `MONGO_URI`              | MongoDB connection string                                   |
| `MONGO_DB_NAME`          | MongoDB database name for this service                      |
| `USER_SERVICE_URL`       | Base URL of the User Service                                |
| `INTERNAL_SERVICE_TOKEN` | Shared backend-only token used for internal auth resolution |

---

## Authentication Design

This service does **not** verify frontend access tokens locally.

Instead, for protected routes it:

1. extracts the Bearer access token from the `Authorization` header
2. sends it to the User Service internal endpoint
3. receives the resolved user object back
4. uses:
    - `user.id` as the canonical user identifier
    - `user.role` for authorization decisions

This avoids auth logic drift across services and ensures that role changes made in User Service are reflected immediately.

### Internal auth call

**Request**

```http
POST http://localhost:3001/internal/auth/resolve
X-Internal-Service-Token: <INTERNAL_SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
    "accessToken": "<frontend_access_token>"
}
```

**Successful response**

```json
{
    "user": {
        "id": "...",
        "username": "...",
        "displayName": "...",
        "email": "...",
        "role": "user"
    }
}
```

---

## Authorization Rules

- **Authenticated users**
    - `GET /questions`
    - `GET /questions/:id`

- **Admin only**
    - `POST /questions`
    - `PUT /questions/:id`
    - `DELETE /questions/:id`

---

## API Endpoints

### Health Check

#### `GET /health`

Returns service health status.

**Response**

```json
{
    "status": "ok",
    "service": "question-service"
}
```

---

### Get All Questions

#### `GET /questions`

Returns all questions.

This route requires authentication.

#### Optional query parameters

- `difficulty` — filter by difficulty
- `category` — filter by category

Example:

```http
GET /questions?difficulty=Easy
GET /questions?category=Arrays
```

---

### Get Question By ID

#### `GET /questions/:id`

Returns a single question by numeric `questionId`.

This route requires authentication.

Example:

```http
GET /questions/1
```

---

### Create Question

#### `POST /questions`

Creates a new question.

This route requires:

- authentication
- admin role

Example body:

```json
{
    "questionId": 1,
    "title": "Two Sum",
    "description": "Given an array of integers...",
    "categories": ["Arrays", "Hash Map"],
    "difficulty": "Easy",
    "sourceUrl": "https://leetcode.com/problems/two-sum/"
}
```

---

### Update Question

#### `PUT /questions/:id`

Updates an existing question by numeric `questionId`.

This route requires:

- authentication
- admin role

Example body:

```json
{
    "title": "Two Sum Updated",
    "difficulty": "Medium"
}
```

---

### Delete Question

#### `DELETE /questions/:id`

Deletes a question by numeric `questionId`.

This route requires:

- authentication
- admin role

---

## Question Schema

Each question document contains:

```ts
{
  questionId: number;
  title: string;
  description: string;
  categories: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  sourceUrl?: string;
}
```

### Notes

- `questionId` is unique
- `title` is trimmed
- `difficulty` must be one of `Easy`, `Medium`, or `Hard`
- Mongoose timestamps are enabled

---

## Request Examples

### Example: Get all questions

```http
GET /questions
Authorization: Bearer <access_token>
```

### Example: Create a question

```http
POST /questions
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
    "questionId": 2,
    "title": "Valid Parentheses",
    "description": "Given a string containing just the characters...",
    "categories": ["Stack", "Strings"],
    "difficulty": "Easy",
    "sourceUrl": "https://leetcode.com/problems/valid-parentheses/"
}
```

---

## Error Handling

Typical error responses include:

- `400 Bad Request`
    - invalid question ID

- `401 Unauthorized`
    - missing or invalid Bearer token
    - failed auth resolution with User Service

- `403 Forbidden`
    - authenticated but insufficient permissions

- `404 Not Found`
    - question not found

- `500 Internal Server Error`
    - unexpected server/database issues

---

## Local Development Notes

- The frontend origin currently allowed by CORS is:
    - `http://localhost:5173`

- For protected route testing, User Service must be running unless the internal auth call is mocked.
- The internal service token is **backend-only** and must never be exposed to the frontend.
- Refresh tokens remain User-Service-only and are not used by Question Service.

---

## Scripts

```bash
npm run dev     # Start in development mode with tsx watch
npm run build   # Compile TypeScript to dist/
npm start       # Run compiled server
```

---

## Example Postman Flow

1. Log in via User Service and obtain an access token
2. Call Question Service endpoints with:

```http
Authorization: Bearer <access_token>
```

3. Test:

- authenticated read access with a normal user
- admin-only write access with an admin
- role change behavior via User Service

---

## Future Improvements

Potential future improvements include:

- request validation with Zod
- pagination for large question sets
- random question retrieval by category/difficulty
- image support inside question content
- soft delete instead of permanent deletion
- optimistic concurrency/versioning for admin updates

---
