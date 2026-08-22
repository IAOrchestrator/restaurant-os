# ADR-001: Modular Monolith instead of Microservices

## Status
Accepted

## Context

Restaurant OS needs to support multiple types of gastronomic establishments (restaurants, pizzerías, cafeterías, heladerías, bares) with strong domain cohesion and rapid iteration during initial development.

## Decision

We will build a **modular monolith** using Clean Architecture, with clear domain boundaries that allow future extraction into services if needed.

## Consequences

### Positive

- Faster development and deployment in early phases
- Strong transactional consistency within the monolith
- Easier refactoring and code navigation
- Lower operational complexity (single deployable unit)
- Clear module boundaries enable future extraction

### Negative

- Risk of tight coupling if boundaries are not respected
- Single technology stack (cannot optimize per-service)
- Horizontal scaling requires scaling entire application

## Alternatives Considered

### Microservices
Rejected. Unnecessary complexity during initial development. Domain boundaries are not yet stable enough to justify service boundaries.

### Serverless (Lambda/Functions)
Rejected. Cold starts unacceptable for real-time restaurant operations. Vendor lock-in concerns.

## Related Decisions

- PostgreSQL as primary database (supports JSONB for event payload)
- Event-driven audit model prepares ground for future event sourcing or CQRS
- Clean Architecture enforces module boundaries at the code level

## Future Considerations

If specific modules (e.g., Analytics, Kitchen Display) require independent scaling or different technology stacks, they can be extracted following the established module boundaries.
