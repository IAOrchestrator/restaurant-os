# Clean Architecture Layers

## Dependency Rule

```
Presentation (apps/web)
    ↓
Application (packages/application)
    ↓
Domain (packages/domain)
    ↓
Infrastructure (packages/infrastructure)
```

## Rules

1. **Domain** does NOT import:
   - Infrastructure
   - Prisma
   - Fastify
   - React
   - Any framework or library except language primitives

2. **Application** does NOT import:
   - Infrastructure implementations directly
   - Framework-specific code

3. **Infrastructure** implements:
   - Repository interfaces defined by Application
   - Event publisher interfaces defined by Application
   - Database access (Prisma)
   - HTTP framework specifics (Fastify plugins)

4. **Presentation** (API):
   - Only orchestrates HTTP input/output
   - Does NOT contain business logic
   - Does NOT access Prisma directly

## Data Flow

```
HTTP Request → Fastify Route → Application Use Case → Domain Logic
                                              ↓
                                        Infrastructure (Prisma)
                                              ↓
HTTP Response ← Fastify Route ← Application Use Case ← Domain Result
```

## Module Structure

Each domain module follows:

```
module/
├── entity.ts           # Domain entity
├── value-object.ts     # Value objects
├── repository.ts       # Repository interface (Application)
├── errors.ts           # Domain errors
└── index.ts            # Public API
```

## Cross-Cutting Concerns

- **EventLog**: All operational changes are logged as domain events
- **Validation**: Zod schemas in `packages/contracts`
- **Configuration**: `packages/config` loads environment variables

## Database Package

The `@restaurant-os/database` package is the **single source of truth** for:
- Prisma schema definition
- Prisma client generation
- Database type exports

It lives at `packages/database/` and is the ONLY package that depends on `@prisma/client` directly.

All other packages (including `apps/api` and `packages/infrastructure`) import the PrismaClient and types from `@restaurant-os/database`.

This prevents:
- Multiple Prisma client instances
- Schema duplication
- Version mismatches between generated client and schema
- Infrastructure leaking into Domain

### Usage

```typescript
// Infrastructure layer ONLY
import { PrismaClient } from '@restaurant-os/database';

export const prisma = new PrismaClient();
```

### Commands

```bash
# Generate client
pnpm --filter @restaurant-os/database db:generate

# Run migrations
pnpm --filter @restaurant-os/database db:migrate

# Open studio
pnpm --filter @restaurant-os/database db:studio
```
