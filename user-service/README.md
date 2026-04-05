# User Service – PeerPrep

The **User Service** is responsible for handling user identity, authentication, authorization (RBAC), and profile management within PeerPrep.

---

## Currently Implemented Features

- Health check endpoint
- User registration
- User login (via username or email)
- Access + Refresh token authentication
- HttpOnly refresh token cookies
- Refresh token rotation
- Stateful logout with token revocation
- Password hashing using bcrypt
- JWT access token verification middleware
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
- cookie-parser

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
JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=<different long random string>
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=10
```

### Notes

- `MONGO_URI` must be the Atlas SRV string (`mongodb+srv://...`)
- Never commit `.env`
- Access JWT payload contains:
    - `sub` → userId
    - `role` → user/admin
    - `type` → `"access"`

- Refresh JWT payload contains:
    - `sub`
    - `role`
    - `type` → `"refresh"`

---

# API Endpoints

---

## Health Check

**GET**

```
/health
```

Returns:

```json
{ "status": "ok" }
```

---

# Authentication Endpoints

---

## Register

**POST**

```
/auth/register
```

### Purpose

Creates a new user account and immediately authenticates them.

### Behavior

- Validates body via Zod
- Hashes password via bcrypt
- Stores user in MongoDB
- Issues:
    - Short-lived **access token** (JSON response)
    - Long-lived **refresh token** (HttpOnly cookie)

### Returns

```json
{
  "user": { ... },
  "accessToken": "..."
}
```

### Cookie Set

```
refreshToken=<JWT>; HttpOnly; Path=/auth; SameSite=Lax
```

---

## Login

**POST**

```
/auth/login
```

Authenticates user and issues:

- New access token
- New refresh token (overwrites previous session)

---

## Refresh Access Token

**POST**

```
/auth/refresh
```

### Purpose

Issues a new access token using the HttpOnly refresh token cookie.

### Behavior

1. Verifies refresh token signature and expiry
2. Confirms refresh token hash matches database
3. Issues:
    - New access token
    - Rotated refresh token (cookie updated)

4. Stores new refresh token hash in DB

### Returns

```json
{
    "accessToken": "..."
}
```

## Logout (Stateful)

**POST**

```
/auth/logout
```

### Purpose

Revokes the current session.

### Behavior

1. Reads refresh token cookie
2. Clears stored refresh token hash in DB
3. Clears refresh cookie

### Returns

```json
{ "message": "Logged out" }
```

After logout:

- `/auth/refresh` will fail with `401`

---

# Protected Routes

---

## User Home

**GET**

```
/home
```

Requires:

```
Authorization: Bearer <accessToken>
```

---

## Admin Home

**GET**

```
/admin/home
```

Requires:

- Valid access token
- Role = `admin`

---

## View Own Profile

**GET**

```
/me
```

Requires access token.

---

## Update Own Profile

**PATCH**

```
/me
```

Requires access token.

---

# Architecture Overview

---

## New Authentication Flow (Access + Refresh)

### First Login / Register

1. Client sends credentials
2. Server verifies user
3. Server issues:
    - Access token (short-lived)
    - Refresh token (HttpOnly cookie)

4. Refresh token hash stored in DB

---

### Accessing Protected Routes

1. Client sends:

```
Authorization: Bearer <accessToken>
```

2. `requireAuth` verifies:
    - signature
    - expiry
    - token type = `"access"`

---

### Refresh Flow

1. Access token expires
2. Client calls `/auth/refresh`
3. Browser automatically sends refresh cookie
4. Server:
    - verifies refresh token
    - checks DB hash
    - rotates refresh token
    - returns new access token

---

### Logout Flow

1. Client calls `/auth/logout`
2. Server:
    - clears refresh hash in DB
    - clears cookie

3. Refresh no longer works

---
