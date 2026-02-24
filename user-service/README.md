# User Service – PeerPrep

The **User Service** is responsible for handling user identity and authentication within PeerPrep.

---

## ✅ Currently Implemented Features

- Health check endpoint
- User registration
- User login (via username or email)
- Password hashing using bcrypt
- JWT access token generation
- JWT verification middleware
- Protected `/api/home` endpoint
- MongoDB Atlas integration
- Centralized error handling middleware

---

# Tech Stack

- **Node.js**
- **TypeScript**
- **Express**
- **MongoDB Atlas**
- **Mongoose**
- **bcrypt**
- **jsonwebtoken (JWT)**

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

---

## 4. Run the Service

```bash
npm run dev
```

Expected output:

```
MongoDB connected
User service listening on http://localhost:3001
```

---

# API Endpoints

## Health Check

**GET**

```
/health
```

Response:

```json
{ "status": "ok" }
```

---

## Register

**POST**

```
/api/auth/register
```

Body:

```json
{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Password123!"
}
```

Returns:

- Created user (without `passwordHash`)
- JWT access token

---

## Login (Username OR Email)

**POST**

```
/api/auth/login
```

Body:

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

Returns:

- User object
- JWT access token

---

## Protected Home Endpoint

**GET**

```
/api/home
```

Headers:

```
Authorization: Bearer <JWT_TOKEN>
```

Returns:

- The currently authenticated user

If no token or invalid token → `401 Unauthorized`.

---

# Simple Testing (PowerShell)

## Register

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3001/api/auth/register" `
  -ContentType "application/json" `
  -Body '{"username":"testuser","email":"test@example.com","password":"Password123!"}'
```

## Login

```powershell
$login = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3001/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"identifier":"testuser","password":"Password123!"}'

$token = $login.token
```

## Access Protected Route

```powershell
Invoke-RestMethod -Method GET `
  -Uri "http://localhost:3001/api/home" `
  -Headers @{ Authorization = "Bearer $token" }
```

---

# Architecture Overview

Request Flow for Protected Routes:

1. Client sends JWT in `Authorization` header
2. `requireAuth` middleware verifies token
3. Middleware attaches `{ userId, role }` to request
4. Controller retrieves authenticated user from DB
5. User data returned (without passwordHash)

---
