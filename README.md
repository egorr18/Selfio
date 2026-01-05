# Selfio Backend API

Production-ready backend for **Selfio** — Go REST API with JWT auth, PostgreSQL, Swagger docs, Docker support, and clean architecture.

Designed to be easy to run locally (1 command) and straightforward to deploy (Render / any Docker platform).

## Features

- Auth: **register / login** (JWT)
- Secure protected routes (middleware)
- PostgreSQL persistence
- Swagger / OpenAPI docs
- Docker & Docker Compose (one-command startup)
- Clean architecture: handlers → services → repository
- Environment-based configuration
- CORS-ready for frontend (GitHub Pages / local dev)

## Tech Stack

- **Language:** Go (see `go.mod`)
- **HTTP:** `net/http`
- **Database:** PostgreSQL
- **Auth:** JWT (`golang-jwt`)
- **Docs:** Swagger (`swaggo/swag`, `swaggo/http-swagger`)
- **Containerization:** Docker, Docker Compose

---

## Quickstart (Local)

### 1) Requirements
- Go 1.21+ (or your version in `go.mod`)
- Docker + Docker Compose

### 2) Configure env
Create `.env` from example:

```bash
cp .env.example .env
