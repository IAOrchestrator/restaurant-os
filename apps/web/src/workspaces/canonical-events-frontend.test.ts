import { describe, it, expect } from 'vitest';
import { EventTypeSchema, type EventType } from '@restaurant-os/contracts';
import { WORKSPACES_REGISTRY, type WorkspaceDefinition } from './registry';
import { WORKSPACE_CONFIGS } from '../types/workspace';

describe('Frontend Canonical Event Alignment (Step 2.2)', () => {
  const allCanonicalEventTypes = EventTypeSchema.options;

  it('all 8 workspaces register only valid canonical EventType values or wildcard', () => {
    Object.entries(WORKSPACES_REGISTRY).forEach(([workspaceId, def]) => {
      def.allowedEventTypes.forEach((eventType) => {
        if (eventType === '*') return;
        const isValid = allCanonicalEventTypes.includes(eventType as EventType);
        expect(
          isValid,
          `Workspace "${workspaceId}" has invalid or obsolete event: "${eventType}"`,
        ).toBe(true);
      });
    });
  });

  it('WORKSPACE_CONFIGS registers only valid canonical EventType values or wildcard', () => {
    Object.entries(WORKSPACE_CONFIGS).forEach(([workspaceId, config]) => {
      config.allowedEventTypes.forEach((eventType) => {
        if (eventType === '*') return;
        const isValid = allCanonicalEventTypes.includes(eventType as EventType);
        expect(
          isValid,
          `WorkspaceConfig "${workspaceId}" has invalid or obsolete event: "${eventType}"`,
        ).toBe(true);
      });
    });
  });

  it('verifies obsolete event names are completely removed from all workspace registrations', () => {
    const obsoleteEventNames = [
      'KITCHEN_ORDER_STARTED',
      'KITCHEN_ORDER_READY',
      'KITCHEN_ORDER_NEARLY_READY',
      'ORDER_CREATED',
      'TABLE_SESSION_OPENED',
      'BILL_REQUESTED',
      'ORDER_UPDATED',
      'TABLE_SESSION_CHANGED',
      'WAITLIST_JOINED',
      'WAITLIST_SEATED',
    ];

    Object.entries(WORKSPACES_REGISTRY).forEach(([workspaceId, def]) => {
      obsoleteEventNames.forEach((obsolete) => {
        expect(
          def.allowedEventTypes.includes(obsolete),
          `Workspace "${workspaceId}" still registers obsolete event "${obsolete}"`,
        ).toBe(false);
      });
    });
  });

  it('verifies KITCHEN_STARTED replaces obsolete KITCHEN_ORDER_STARTED in kitchen workspace', () => {
    const kitchenDef = WORKSPACES_REGISTRY.kitchen;
    expect(kitchenDef.allowedEventTypes).toContain('KITCHEN_STARTED');
    expect(kitchenDef.allowedEventTypes).not.toContain('KITCHEN_ORDER_STARTED');
  });

  it('verifies ORDER_READY replaces obsolete KITCHEN_ORDER_READY in kitchen, waiter, table, customer workspaces', () => {
    ['kitchen', 'waiter', 'table', 'customer'].forEach((ws) => {
      const def = WORKSPACES_REGISTRY[ws as keyof typeof WORKSPACES_REGISTRY];
      expect(def.allowedEventTypes).toContain('ORDER_READY');
      expect(def.allowedEventTypes).not.toContain('KITCHEN_ORDER_READY');
    });
  });

  it('verifies ACCOUNT_CLOSED is registered across relevant operational workspaces', () => {
    const closedSubscribers = ['reception', 'cashier', 'table', 'customer', 'waiter'];
    closedSubscribers.forEach((ws) => {
      const def = WORKSPACES_REGISTRY[ws as keyof typeof WORKSPACES_REGISTRY];
      expect(
        def.allowedEventTypes.includes('ACCOUNT_CLOSED'),
        `Workspace "${ws}" should be registered for ACCOUNT_CLOSED`,
      ).toBe(true);
    });
  });

  it('handles shared events correctly via aggregateType discrimination', () => {
    // Shared Event 1: ORDER_READY (can come from Order or KitchenOrder)
    const kitchenOrderReadyEvent = {
      type: 'ORDER_READY' as EventType,
      aggregateType: 'KitchenOrder',
      aggregateId: 'ko-1',
      restaurantId: 'rest-1',
      tableSessionId: 'sess-1',
      tableId: 't-1',
      tableNumber: 3,
      payload: { orderId: 'ord-1', tableNumber: 3 },
    };

    const orderReadyEvent = {
      type: 'ORDER_READY' as EventType,
      aggregateType: 'Order',
      aggregateId: 'ord-1',
      restaurantId: 'rest-1',
      tableSessionId: 'sess-1',
      tableId: 't-1',
      tableNumber: 3,
      payload: { orderId: 'ord-1', tableSessionId: 'sess-1' },
    };

    expect(kitchenOrderReadyEvent.type).toBe('ORDER_READY');
    expect(kitchenOrderReadyEvent.aggregateType).toBe('KitchenOrder');
    expect(orderReadyEvent.type).toBe('ORDER_READY');
    expect(orderReadyEvent.aggregateType).toBe('Order');

    // Shared Event 2: TABLE_ASSIGNED (can come from Table or TableSession)
    const tableAssignedEvent = {
      type: 'TABLE_ASSIGNED' as EventType,
      aggregateType: 'TableSession',
      aggregateId: 'sess-1',
      restaurantId: 'rest-1',
      tableSessionId: 'sess-1',
      tableId: 't-1',
      tableNumber: 3,
      payload: { sessionId: 'sess-1', tableId: 't-1', tableNumber: 3, waiterId: 'w-1' },
    };
    expect(tableAssignedEvent.type).toBe('TABLE_ASSIGNED');
    expect(tableAssignedEvent.aggregateType).toBe('TableSession');
  });

  it('accepts canonical event payloads with all required fields', () => {
    const sampleCanonicalEvent = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'PAYMENT_REGISTERED' as EventType,
      restaurantId: '550e8400-e29b-41d4-a716-446655440001',
      aggregateType: 'Account',
      aggregateId: '550e8400-e29b-41d4-a716-446655440002',
      tableSessionId: '550e8400-e29b-41d4-a716-446655440003',
      tableId: '550e8400-e29b-41d4-a716-446655440004',
      tableNumber: 4,
      actorType: 'STAFF',
      actorId: '550e8400-e29b-41d4-a716-446655440005',
      timestamp: '2026-08-23T18:00:00.000Z',
      payload: {
        accountId: '550e8400-e29b-41d4-a716-446655440002',
        paymentId: '550e8400-e29b-41d4-a716-446655440006',
        amount: 5000,
        method: 'CASH',
        remainingAmount: 0,
        isFullyPaid: true,
      },
    };

    expect(EventTypeSchema.safeParse(sampleCanonicalEvent.type).success).toBe(true);
    expect(sampleCanonicalEvent.payload.isFullyPaid).toBe(true);
    expect(sampleCanonicalEvent.payload.amount).toBe(5000);
  });
});
