# Contributing to Selfio

Thanks for your interest in contributing!

## Project setup

### Requirements
- Go 1.22+
- Docker + Docker Compose

### Local development (Backend)
1. Copy env (pick one):
    - If you use docker env file: use `.env.docker`
    - Or create `.env` from `.env.example`

2. Start services:
```bash
docker compose up -d --build
