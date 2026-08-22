# Restaurant OS

Restaurant Operating System — Modular monolith for gastronomic establishments.

## Overview

A TypeScript-based, Clean Architecture system for managing restaurants, pizzerías, cafeterías, heladerías, bares, and other gastronomic establishments.

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 15

### Install

```bash
pnpm install
```

### Environment

Create `.env` in `apps/api`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/restaurant_os"
PORT=3000
NODE_ENV=development
```

### Database

```bash
pnpm db:generate
pnpm db:migrate
```

### Development

```bash
# API + Web concurrently
pnpm dev

# Or individually
pnpm --filter @restaurant-os/api dev
pnpm --filter @restaurant-os/web dev
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Lint & Format

```bash
pnpm lint
pnpm format
```

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces
- **Backend**: Node.js + Fastify
- **Frontend**: React + Vite
- **Database**: PostgreSQL + Prisma ORM
- **Validation**: Zod
- **Testing**: Vitest

## Project Memory

**Before any development task, read `docs/PROJECT_MEMORY.md`.**

This file contains the current state, decisions, open questions, and next steps.

## Documentation

- `docs/architecture/overview.md` — System overview
- `docs/architecture/layers.md` — Clean Architecture layers
- `docs/domain/domain-model.md` — Domain entities and relationships
- `docs/decisions/ADR-001-monolith-modular.md` — Architecture Decision Record
- `docs/PROJECT_MEMORY.md` — Project continuity memory

## Current Phase

**Phase 1 — Foundation**

- Monorepo structure ✅
- Clean Architecture scaffolding ✅
- Prisma schema ✅
- API health + version endpoints ✅
- Frontend minimal app ✅
- Tests ✅
- Documentation ✅

## License

Proprietary — All rights reserved.
