# Selfio Backend API

Production-ready backend for **Selfio** — Go REST API with JWT auth, PostgreSQL, Swagger docs, Docker support, and clean architecture.

Designed to be easy to run locally (1 command) and straightforward to deploy (Render / any Docker platform).

## Features

-  Auth: **register / login** (JWT)
-  Secure protected routes (middleware)
-  PostgreSQL persistence
-  Swagger / OpenAPI docs
-  Docker & Docker Compose (one-command startup)
-  Clean architecture: handlers → services → repository
-  Environment-based configuration
-  CORS-ready for frontend (GitHub Pages / local dev)

## Tech Stack

- **Language:** Go (see `go.mod`)
- **HTTP:** `net/http`
- **Database:** PostgreSQL
- **Auth:** JWT (`golang-jwt`)
- **Docs:** Swagger (`swaggo`)
- **Containerization:** Docker, Docker Compose

## API Overview

### Auth

#### `POST /auth/register`
Creates a new user.

**Body**
```json
{
  "email": "user@example.com",
  "password": "strong_password"
}
