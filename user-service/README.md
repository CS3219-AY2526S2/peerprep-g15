# User Service – PeerPrep

The **User Service** is responsible for handling user identity, authentication, authorization (RBAC), and profile management within PeerPrep.

---

## Currently Implemented Features

- Health check endpoint
- User registration
- User login (via username or email)
- Stateless logout endpoint
- Password hashing using bcrypt
- JWT access token generation
- JWT verification middleware
- Role-based access control (RBAC)
- Protected user landing page (`/home`)
- Protected admin landing page (`/admin/home`)
- Profile viewing and editing (`/me`)
- MongoDB Atlas integration
- Centralized error handling middleware
- Zod-based request validation

---

# Tech Stack

- Node.js
- TypeScript
- Express
- MongoDB Atlas
- Mongoose
- bcrypt
- jsonwebtoken (JWT)
- Zod

---

# Setup

## 1. Install Node.js

Install Node.js (v24 recommended).

Verify installation:

```bash
node -v
npm -v
```

---

## 2. Install Dependencies

Navigate to the user-service folder:

```bash
cd .\user-service
npm install
```

---

## 3. Configure Environment Variables

Create:

```
/user-service/.env
```

Add:

```env
PORT=3001
NODE_ENV=development

MONGO_URI=<your MongoDB Atlas SRV connection string>
MONGO_DB_NAME=peerprep_dev_<yourname>

JWT_SECRET=<long random string>
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
```

### Notes

- `MONGO_URI` must be the Atlas SRV string (`mongodb+srv://...`)
- Never commit `.env`
- JWT contains `{ sub: userId, role }` in payload

---

# API Endpoints

---

## Health Check

**GET**

```
/health
```

### Purpose

Used by deployment platforms or other services to verify that the User Service is running and responsive.

### Response

```json
{ "status": "ok" }
```

---

## Register

**POST**

```
/auth/register
```

### Purpose

Creates a new user account.

- Validates request body using Zod
- Hashes password using bcrypt
- Stores user in MongoDB
- Returns JWT access token for immediate login

### Body

```json
{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Password123!"
}
```

### Returns

- Created user (without `passwordHash` and without Mongo `_id`)
- JWT access token

### Possible Errors

- `400` – Invalid request body
- `409` – Username or email already in use

---

## Login (Username OR Email)

**POST**

```
/auth/login
```

### Purpose

Authenticates a user or admin and issues a JWT access token.

- Accepts either username or email as identifier
- Verifies password using bcrypt
- Includes `role` in JWT payload

### Body

```json
{
    "identifier": "testuser",
    "password": "Password123!"
}
```

or

```json
{
    "identifier": "test@example.com",
    "password": "Password123!"
}
```

### Returns

- User object (without passwordHash and `_id`)
- JWT access token

### Possible Errors

- `400` – Invalid request body
- `401` – Invalid credentials

---

## Logout

**POST**

```
/auth/logout
```

### Purpose

Logs out the currently authenticated user.

Currently stateless. Since refresh tokens are not implemented yet, logout simply returns success and the frontend should delete the stored JWT.

### Headers

```
Authorization: Bearer <JWT_TOKEN>
```

### Returns

```json
{ "message": "Logged out" }
```

---

## User Home

**GET**

```
/home
```

### Purpose

Landing page for authenticated users.

This will eventually serve as the entry point for:

- Queueing for question matching
- Viewing user-specific session information

### Headers

```
Authorization: Bearer <JWT_TOKEN>
```

### Returns

```json
{
  "message": "User home",
  "user": { ... }
}
```

### Possible Errors

- `401` – Missing or invalid token

---

## Admin Home

**GET**

```
/admin/home
```

### Purpose

Landing page for administrators.

This will eventually serve as the entry point for:

- Question CRUD management
- Administrative features

### Headers

```
Authorization: Bearer <JWT_TOKEN>
```

### Access Control

- Requires valid JWT
- Requires role = `admin`

### Possible Errors

- `401` – Missing or invalid token
- `403` – Insufficient permissions

---

## View Own Profile

**GET**

```
/me
```

### Purpose

Returns the currently authenticated user’s profile information.

Mongo `_id` is hidden and immutable.

### Headers

```
Authorization: Bearer <JWT_TOKEN>
```

### Returns

```json
{
    "user": {
        "username": "testuser",
        "email": "test@example.com",
        "preferredLanguages": ["python"],
        "skillLevel": "intermediate",
        "role": "user"
    }
}
```

---

## Update Own Profile

**PATCH**

```
/me
```

### Purpose

Allows users to update their profile fields:

- `username`
- `email`
- `preferredLanguages`
- `skillLevel`
- Optional password change

### Headers

```
Authorization: Bearer <JWT_TOKEN>
```

### Example Body (Profile Update)

```json
{
    "preferredLanguages": ["python", "typescript"],
    "skillLevel": "advanced"
}
```

### Example Body (Password Change)

```json
{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword123!"
}
```

> To change password, both `currentPassword` and `newPassword` must be provided.

### Possible Errors

- `400` – Invalid request body
- `401` – Incorrect current password
- `409` – Username or email already in use

---

# Architecture Overview

### Authentication Flow

1. Client sends credentials to `/auth/login`
2. Server verifies credentials
3. Server signs JWT containing:
    - `sub` → userId
    - `role` → user/admin

4. Client stores JWT
5. Client sends JWT in `Authorization: Bearer <token>` header for protected routes

---

### Protected Route Flow

1. `requireAuth` middleware verifies JWT
2. Middleware attaches `{ userId, role }` to request
3. `requireRole('admin')` checks authorization
4. Controller retrieves user from database
5. Safe user object returned (no passwordHash, no `_id`)
