# User Service – PeerPrep

The **User Service** is responsible for user identity, authentication, authorization (RBAC), profile management, and internal token resolution within PeerPrep.

---

## Currently Implemented Features

- Health check endpoint
- User registration
- User login via **username or email**
- JWT-based **access token** authentication
- JWT-based **refresh token** authentication
- HttpOnly refresh token cookies
- Refresh token rotation
- Stateful logout with refresh token revocation
- Password hashing using bcrypt
- Access token verification middleware
- Role-based access control (RBAC)
- Protected user home route (`/home`)
- Protected admin home route (`/admin/home`)
- Admin user listing with:
    - search
    - role filter
    - pagination
- Admin user promotion
- Admin user demotion
- Admin user deletion
- Protected profile viewing, updating, and self-deletion (`/me`)
- Internal service token-protected auth resolution endpoint
- MongoDB integration via Mongoose
- Centralized not-found and error handling middleware
- Zod-based request body and query validation

---

# Tech Stack

- Node.js
- TypeScript
- Express
- MongoDB
- Mongoose
- bcrypt
- jsonwebtoken (JWT)
- Zod
- cookie-parser
- cors
- helmet

---

# Setup

## 1. Install Node.js

Install Node.js.

Verify installation:

```bash
node -v
npm -v
```

---

## 2. Install Dependencies

Navigate to the `user-service` folder:

```bash
cd .\user-service
npm install
```

---

## 3. Configure Environment Variables

Create:

```env
/user-service/.env
```

Add:

```env
PORT=3001
NODE_ENV=development

MONGO_URI=<your MongoDB connection string>
MONGO_DB_NAME=peerprep_dev_<yourname>

JWT_SECRET=<long random string>
JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=<different long random string>
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=10

INTERNAL_SERVICE_TOKEN=<shared secret for internal services>
```

### JWT Payloads

#### Access token payload

- `sub` → user ID
- `role` → `user` or `admin`
- `type` → `"access"`

#### Refresh token payload

- `sub` → user ID
- `role` → `user` or `admin`
- `type` → `"refresh"`

---

# Running the Service

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Start production build

```bash
npm start
```

---

# API Endpoints

---

## Health Check

### `GET /health`

Returns:

```json
{ "status": "ok" }
```

---

# Authentication Endpoints

---

## Register

### `POST /auth/register`

### Purpose

Creates a new user account and immediately authenticates them.

### Request Body

```json
{
    "username": "johndoe",
    "displayName": "John Doe",
    "email": "john@example.com",
    "password": "password123"
}
```

### Behavior

- Validates body with Zod
- Normalizes username and email
- Hashes password with bcrypt
- Creates user with default:
    - `role = "user"`
    - `preferredLanguages = []`
    - `skillLevel = "beginner"`

- Issues:
    - access token in JSON response
    - refresh token in HttpOnly cookie

- Stores refresh token hash in database

### Returns

```json
{
    "user": { "...": "..." },
    "accessToken": "..."
}
```

### Cookie Set

```text
refreshToken=<JWT>; HttpOnly; Path=/auth; SameSite=Lax
```

---

## Login

### `POST /auth/login`

### Purpose

Authenticates an existing user using either username or email.

### Request Body

```json
{
    "identifier": "johndoe",
    "password": "password123"
}
```

or

```json
{
    "identifier": "john@example.com",
    "password": "password123"
}
```

### Behavior

- Validates request body
- Looks up user by username or email
- Verifies password using bcrypt
- Issues:
    - new access token
    - new refresh token cookie

- Replaces previous stored refresh token hash

### Returns

```json
{
    "user": { "...": "..." },
    "accessToken": "..."
}
```

---

## Refresh Access Token

### `POST /auth/refresh`

### Purpose

Issues a new access token using the HttpOnly refresh token cookie.

### Behavior

1. Reads refresh token from cookie
2. Verifies refresh token signature and expiry
3. Looks up user by token subject
4. Confirms provided refresh token hash matches stored database hash
5. Issues:
    - new access token
    - rotated refresh token

6. Stores new refresh token hash in database

### Returns

```json
{
    "accessToken": "..."
}
```

### Notes

- If the cookie is missing, returns `401`
- If the token is invalid, expired, or revoked, returns `401`

---

## Logout

### `POST /auth/logout`

### Purpose

Logs the user out by revoking the current refresh session.

### Behavior

1. Reads refresh token from cookie if present
2. Clears the stored refresh token hash and issued-at timestamp
3. Clears the refresh cookie

### Returns

```json
{ "message": "Logged out" }
```

### Notes

After logout:

- `/auth/refresh` will fail for that session

---

# Protected Routes

All protected routes require:

```text
Authorization: Bearer <accessToken>
```

---

## User Home

### `GET /home`

### Purpose

Returns the authenticated user’s home payload.

### Returns

```json
{
    "message": "User home",
    "user": { "...": "..." }
}
```

---

## View Own Profile

### `GET /me`

### Purpose

Returns the authenticated user’s profile.

### Returns

```json
{
    "user": { "...": "..." }
}
```

---

## Update Own Profile

### `PATCH /me`

### Purpose

Updates the authenticated user’s profile.

### Supported Fields

```json
{
    "username": "newusername",
    "displayName": "New Display Name",
    "email": "new@example.com",
    "preferredLanguages": ["JavaScript", "TypeScript"],
    "skillLevel": "intermediate",
    "currentPassword": "oldpassword",
    "newPassword": "newpassword123"
}
```

### Behavior

- Validates body with Zod
- Allows updating:
    - username
    - displayName
    - email
    - preferredLanguages
    - skillLevel

- Enforces uniqueness checks for username and email
- Password changes require both:
    - `currentPassword`
    - `newPassword`

- If password is changed:
    - password hash is updated
    - all refresh sessions are revoked

### Returns

```json
{
    "user": { "...": "..." }
}
```

---

## Delete Own Account

### `DELETE /me`

### Purpose

Deletes the authenticated user’s own account.

### Behavior

- Deletes the current user
- If the user is an admin, deletion is blocked if they are the **last remaining admin**

### Returns

```json
{
    "message": "Account deleted successfully"
}
```

---

# Admin Routes

All admin routes require:

- valid access token
- authenticated user’s latest database role to be `admin`

---

## Admin Home

### `GET /admin/home`

Returns:

```json
{
    "message": "Admin home",
    "auth": {
        "userId": "...",
        "role": "admin"
    }
}
```

---

## List Users

### `GET /admin/users`

### Purpose

Lists users with optional search, role filtering, and pagination.

### Query Parameters

- `search` → optional text search across:
    - username
    - displayName
    - email

- `role` → optional (`user` or `admin`)
- `page` → optional, default `1`
- `limit` → optional, default `10`, max `50`

### Example

```text
/admin/users?search=john&role=user&page=1&limit=10
```

### Returns

```json
{
    "users": [{ "...": "..." }],
    "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
    }
}
```

---

## Promote User to Admin

### `POST /admin/promote`

### Request Body

```json
{
    "username": "targetuser"
}
```

### Behavior

- Finds target user by username
- Promotes them from `user` to `admin`
- Revokes all of their refresh sessions

### Returns

```json
{
    "message": "User promoted to admin",
    "user": { "...": "..." }
}
```

### Errors

- `404` if user not found
- `409` if user is already an admin

---

## Demote Admin to User

### `POST /admin/demote`

### Request Body

```json
{
    "username": "targetadmin"
}
```

### Behavior

- Finds target user by username
- Demotes them from `admin` to `user`
- Revokes all of their refresh sessions

### Restrictions

- admins cannot demote themselves
- last remaining admin cannot be demoted

### Returns

```json
{
    "message": "User demoted to normal user",
    "user": { "...": "..." }
}
```

### Errors

- `404` if user not found
- `409` if user is already a normal user
- `403` if self-demotion is attempted
- `403` if target is the last remaining admin

---

## Delete User

### `DELETE /admin/users/:username`

### Purpose

Deletes another user’s account.

### Restrictions

- admins cannot delete themselves
- last remaining admin cannot be deleted

### Returns

```json
{
    "message": "User 'targetuser' deleted successfully"
}
```

### Errors

- `404` if user not found
- `403` if self-deletion is attempted via admin route
- `403` if target is the last remaining admin

---

# Internal Service Route

---

## Resolve User From Access Token

### `POST /internal/auth/resolve`

### Purpose

Allows trusted internal services to resolve a user from an access token.

### Protection

Requires header:

```text
X-Internal-Service-Token: <INTERNAL_SERVICE_TOKEN>
```

### Request Body

```json
{
    "accessToken": "<access token>"
}
```

### Behavior

- verifies internal service token
- validates request body
- verifies provided access token
- fetches the latest user record from database
- returns minimal user identity and role information

### Returns

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

# Authentication and Authorization Flow

---

## Register / Login Flow

1. Client submits credentials
2. Server validates credentials
3. Server issues:
    - short-lived access token
    - long-lived refresh token cookie

4. Server stores refresh token hash in database

---

## Accessing Protected Routes

1. Client sends:

```text
Authorization: Bearer <accessToken>
```

2. `requireAuth` verifies:
    - Authorization header format
    - token signature
    - token expiry
    - token type is `"access"`

3. Protected controller executes

---

## Role-Protected Admin Routes

1. User first passes `requireAuth`
2. `requireRole(...)` fetches the user’s latest role from database
3. Access is granted only if current DB role matches allowed roles

### Why this matters

This prevents stale admin access from surviving role changes.
For example, if an admin is demoted, an old access token with `role: "admin"` should no longer grant admin route access.

---

## Refresh Flow

1. Access token expires
2. Client calls `/auth/refresh`
3. Browser sends refresh cookie automatically
4. Server:
    - verifies refresh token
    - compares token hash with stored hash
    - issues new access token
    - rotates refresh token
    - stores new refresh token hash

---

## Logout Flow

1. Client calls `/auth/logout`

2. Server:
    - revokes stored refresh token hash
    - clears cookie

3. Further refresh attempts fail

---

## Password Change Flow

1. Authenticated user sends:
    - `currentPassword`
    - `newPassword`

2. Server verifies current password

3. Server updates password hash

4. Server revokes all refresh sessions

This forces the user to log in again on other sessions.

---

# Validation

The service uses **Zod** for request validation.

### Request body validation

- `/auth/register`
- `/auth/login`
- `/admin/promote`
- `/admin/demote`
- `/me`
- `/internal/auth/resolve`

### Query validation

- `/admin/users`

Invalid request bodies or query parameters return `400 Bad Request`.

---

# Error Handling

The service includes:

- centralized `404 Route not found` handling
- centralized application error handling
- mapped `AppError` responses
- MongoDB duplicate key conflict handling

### Common Error Codes

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `INTERNAL_SERVER_ERROR`

---

# Security Notes

- Passwords are hashed with bcrypt before storage
- Refresh tokens are stored as **hashes**, not raw tokens
- Refresh tokens are sent in **HttpOnly cookies**
- Access tokens are required for protected routes
- Internal auth route is protected by shared secret header
- Admin role is checked against the **database**, not trusted solely from JWT payload
- Refresh sessions are revoked on:
    - logout
    - password change
    - admin promotion/demotion

---

# Testing

Current test-related scripts:

```bash
npm run test
npm run test:run
npm run test:watch
npm run test:coverage
```

---
