# Architecture Overview

## System Context

Restaurant OS is a modular monolith designed to support multiple types of gastronomic establishments through a single, cohesive codebase.

## High-Level Structure

```
restaurant-os/
├── apps/
│   ├── api/          Fastify HTTP API
│   └── web/          React + Vite SPA
├── packages/
│   ├── domain/       Pure business logic
│   ├── application/  Use cases and ports
│   ├── contracts/    Shared Zod schemas
│   ├── infrastructure/ Prisma, messaging, etc.
│   ├── config/       Environment configuration
│   └── ui/           Shared React components
└── docs/             Documentation
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| Runtime | Node.js 20+ |
| Package Manager | pnpm |
| Monorepo | Turborepo |
| Backend Framework | Fastify |
| Frontend Framework | React + Vite |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Testing | Vitest |
| Linting | ESLint |
| Formatting | Prettier |

## Deployment Model

Single deployable unit (modular monolith). Future extraction of services is possible but not required for initial phases.
