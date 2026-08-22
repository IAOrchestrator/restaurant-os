# Domain Model

## Core Entities

### Restaurant
Represents an establishment. Supports future multi-tenant / multi-branch scenarios.

### Staff
Internal users with roles:
- ADMIN
- RECEPTIONIST
- WAITER
- KITCHEN
- CASHIER

### Customer
External client. Can join waitlist, place pre-orders, and create orders.

### Table
Physical table with:
- number
- capacity
- status (AVAILABLE, ASSIGNED, OCCUPIED)

### TableSession
Represents a concrete occupation of a table over time.
- One Table → many TableSessions
- Enables history, metrics, and session-specific data

### WaitlistEntry
Customer/group waiting for a table.
- Stores party size, status, timestamps
- Optional pre-order
- Call/confirmation flow

### PreOrder
Customer-prepared order BEFORE or DURING wait.
- NOT a kitchen order
- Status: DRAFT → READY → REVIEWING → CONFIRMED → CANCELLED

### Order
Confirmed order by waiter, sent to kitchen.
- Multiple Orders per TableSession possible
- Status: DRAFT → CONFIRMED → SENT_TO_KITCHEN → PREPARING → READY → DELIVERED → CANCELLED

### Account
Economic account for a TableSession.
- Status: OPEN → REQUESTED → PAID → CLOSED

### Payment
Payment record (system does NOT process payments in Phase 1).

### Catalog
Products and categories available for ordering.

### Review
Customer feedback for a restaurant.

### EventLog
Audit trail of all significant domain events.

## Relationships

```
Restaurant 1--* Staff
Restaurant 1--* Table
Restaurant 1--* WaitlistEntry
Restaurant 1--* TableSession
Restaurant 1--* PreOrder
Restaurant 1--* Order
Restaurant 1--* Account
Restaurant 1--* EventLog
Restaurant 1--* Review

Table 1--* TableSession
TableSession 1--* Order
TableSession 1--* Account
Account 1--* Payment

Customer 1--* WaitlistEntry
Customer 1--* PreOrder
Customer 1--* Order
Customer 1--* Review
```

## State Machines

See `PROJECT_MEMORY.md` section 8 for complete state definitions.

## Invariants (Confirmed)

- A Table can only have one active TableSession at a time.
- A Table is released when its TableSession is CLOSED.
- Kitchen only receives CONFIRMED Orders.
- Waiter can be changed without closing TableSession.
- PreOrder is NOT automatically an Order.
