import { describe, it, expect } from 'vitest';
import {
  HealthResponseSchema,
  VersionResponseSchema,
  WaitlistStatusSchema,
  TableStatusSchema,
  TableSessionStatusSchema,
  PreOrderStatusSchema,
  OrderStatusSchema,
  AccountStatusSchema,
  StaffRoleSchema,
  EventTypeSchema,
} from '../src/index';

describe('Contracts', () => {
  it('HealthResponseSchema validates correct shape', () => {
    const data = { status: 'ok' as const, timestamp: new Date().toISOString() };
    expect(() => HealthResponseSchema.parse(data)).not.toThrow();
  });

  it('VersionResponseSchema validates correct shape', () => {
    const data = { version: '0.1.0', apiVersion: '0.1.0' };
    expect(() => VersionResponseSchema.parse(data)).not.toThrow();
  });

  it('All status enums have expected values', () => {
    expect(WaitlistStatusSchema.options).toContain('WAITING');
    expect(WaitlistStatusSchema.options).toContain('SEATED');
    expect(TableStatusSchema.options).toContain('AVAILABLE');
    expect(TableSessionStatusSchema.options).toContain('CLOSED');
    expect(PreOrderStatusSchema.options).toContain('CONFIRMED');
    expect(OrderStatusSchema.options).toContain('DELIVERED');
    expect(AccountStatusSchema.options).toContain('PAID');
    expect(StaffRoleSchema.options).toContain('WAITER');
    expect(EventTypeSchema.options).toContain('TABLE_CLOSED');
  });
});
