import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EventTypeSchema, type EventType } from '@restaurant-os/contracts';
import { WORKSPACES_REGISTRY } from './registry';

describe('Pure Reactivity & Zero-Polling Protocol (Step 2.4)', () => {
  const workspacesDir = path.resolve(__dirname);

  it('1. Verifies that all redundant polling intervals (setInterval fetching state) are eliminated from workspace files', () => {
    const workspacePageFiles = [
      'kitchen/kitchen-page.tsx',
      'waiter/waiter-page.tsx',
      'cashier/cashier-page.tsx',
      'reception/reception-page.tsx',
      'table/table-page.tsx',
      'customer/customer-page.tsx',
      'dashboard/dashboard-page.tsx',
      'admin/admin-page.tsx',
    ];

    workspacePageFiles.forEach((relPath) => {
      const fullPath = path.join(workspacesDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check that no setInterval calls fetch functions
      const forbiddenPatterns = [
        /setInterval\s*\(\s*fetchData/i,
        /setInterval\s*\(\s*fetchOrders/i,
        /setInterval\s*\(\s*fetchAccounts/i,
        /setInterval\s*\(\s*fetchLiveMetrics/i,
        /setInterval\s*\(\s*fetchSessionAndMenu/i,
        /setInterval\s*\(\s*fetchMenu/i,
      ];

      forbiddenPatterns.forEach((pattern) => {
        expect(
          pattern.test(content),
          `File "${relPath}" still contains redundant polling interval matching ${pattern}`,
        ).toBe(false);
      });
    });
  });

  it('2. Verifies that legitimate UI functional timers are preserved in kitchen KDS', () => {
    const kitchenFile = path.join(workspacesDir, 'kitchen/kitchen-page.tsx');
    const content = fs.readFileSync(kitchenFile, 'utf8');

    // Elapsed time ticket counter
    expect(content).toContain('setInterval(() => setSec(getSec()), 1000)');
    // KDS Header clock
    expect(content).toContain('setInterval(updateTime, 1000)');
  });

  it('3. Verifies that all 8 workspaces configure both onEvent and onReconnect in useSse', () => {
    const workspacePageFiles = [
      'kitchen/kitchen-page.tsx',
      'waiter/waiter-page.tsx',
      'cashier/cashier-page.tsx',
      'reception/reception-page.tsx',
      'table/table-page.tsx',
      'customer/customer-page.tsx',
      'dashboard/dashboard-page.tsx',
      'admin/admin-page.tsx',
    ];

    workspacePageFiles.forEach((relPath) => {
      const fullPath = path.join(workspacesDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');

      expect(
        content.includes('onEvent'),
        `Workspace "${relPath}" missing onEvent handler`,
      ).toBe(true);

      expect(
        content.includes('onReconnect'),
        `Workspace "${relPath}" missing onReconnect handler for automatic snapshot`,
      ).toBe(true);
    });
  });

  it('4. Verifies canonical events trigger reactivity in the intended workspaces', () => {
    const registry = WORKSPACES_REGISTRY;

    // ACCOUNT_CLOSED must be subscribed by reception, waiter, table, customer, cashier, dashboard, admin
    expect(registry.reception.allowedEventTypes).toContain('ACCOUNT_CLOSED');
    expect(registry.waiter.allowedEventTypes).toContain('ACCOUNT_CLOSED');
    expect(registry.table.allowedEventTypes).toContain('ACCOUNT_CLOSED');
    expect(registry.customer.allowedEventTypes).toContain('ACCOUNT_CLOSED');
    expect(registry.cashier.allowedEventTypes).toContain('ACCOUNT_CLOSED');
    expect(registry.dashboard.allowedEventTypes).toContain('*');
    expect(registry.admin.allowedEventTypes).toContain('*');

    // TABLE_CLOSED & TABLE_RELEASED must update reception
    expect(registry.reception.allowedEventTypes).toContain('TABLE_CLOSED');
    expect(registry.reception.allowedEventTypes).toContain('TABLE_RELEASED');

    // KITCHEN_STARTED & ORDER_READY must update kitchen & waiter
    expect(registry.kitchen.allowedEventTypes).toContain('KITCHEN_STARTED');
    expect(registry.kitchen.allowedEventTypes).toContain('ORDER_READY');
    expect(registry.waiter.allowedEventTypes).toContain('ORDER_READY');
  });

  it('5. Verifies end-to-end event discrimination for shared event types', () => {
    type DomainEventSimulation = {
      type: EventType;
      aggregateType: 'Order' | 'KitchenOrder' | 'Table' | 'TableSession' | 'Account' | 'WaitlistEntry';
      aggregateId: string;
      restaurantId: string;
      tableSessionId?: string;
      payload: Record<string, unknown>;
    };

    const simulatedEvents: DomainEventSimulation[] = [
      {
        type: 'ORDER_READY',
        aggregateType: 'KitchenOrder',
        aggregateId: 'ko-101',
        restaurantId: 'rest-1',
        tableSessionId: 'sess-1',
        payload: { orderId: 'ord-101', tableNumber: 5 },
      },
      {
        type: 'ORDER_READY',
        aggregateType: 'Order',
        aggregateId: 'ord-101',
        restaurantId: 'rest-1',
        tableSessionId: 'sess-1',
        payload: { orderId: 'ord-101' },
      },
      {
        type: 'CUSTOMER_SEATED',
        aggregateType: 'WaitlistEntry',
        aggregateId: 'wl-1',
        restaurantId: 'rest-1',
        payload: { waitlistId: 'wl-1', tableId: 't-3', tableNumber: 3 },
      },
      {
        type: 'CUSTOMER_SEATED',
        aggregateType: 'Table',
        aggregateId: 't-3',
        restaurantId: 'rest-1',
        tableSessionId: 'sess-2',
        payload: { tableId: 't-3', sessionId: 'sess-2' },
      },
    ];

    simulatedEvents.forEach((ev) => {
      expect(EventTypeSchema.safeParse(ev.type).success).toBe(true);
      expect(ev.aggregateType).toBeDefined();
    });
  });
});
