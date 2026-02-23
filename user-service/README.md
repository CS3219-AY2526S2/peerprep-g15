# User Service – PeerPrep

The User Service is responsible for handling user identity and authentication within PeerPrep.

Currently implemented features:

- Health check endpoint
- User registration
- User login (via username or email)
- Password hashing with bcrypt
- JWT access token generation
- MongoDB Atlas integration
- Centralized error handling

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

```
node -v
npm -v
```

---

## 2. Install Dependencies

Navigate to the user-service folder:

```
cd .\user-service
npm install
```

---

## 3. Configure Environment Variables

Create a file:

```
services/user-service/.env
```

Add the following (replace placeholders):

```
PORT=3001
NODE_ENV=development

MONGO_URI=<your MongoDB Atlas SRV connection string>
MONGO_DB_NAME=peerprep_dev_<yourname>

JWT_SECRET=<long random string>
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
```

### Notes

- `MONGO_URI` should be the Atlas SRV string (mongodb+srv://...)
- Never commit `.env`

---

## 4. Run the Service

Start in development mode:

```
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

```
{ "status": "ok" }
```

---

## Register

**POST**

```
/api/auth/register
```

Body:

```
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Password123!"
}
```

Returns:

- Created user (without passwordHash)
- JWT token

---

## Login (Username OR Email)

**POST**

```
/api/auth/login
```

Body:

```
{
  "identifier": "testuser",
  "password": "Password123!"
}
```

or

```
{
  "identifier": "test@example.com",
  "password": "Password123!"
}
```

Returns:

- User object
- JWT token

---

# Simple Testing (PowerShell)

### Register

```
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3001/api/auth/register" `
  -ContentType "application/json" `
  -Body '{"username":"testuser","email":"test@example.com","password":"Password123!"}'
```

### Login

```
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3001/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"identifier":"testuser","password":"Password123!"}'
```
