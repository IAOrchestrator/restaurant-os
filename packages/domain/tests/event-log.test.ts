import { describe, it, expect } from 'vitest';
import { EventLog, EventType, EventLogDomainError } from '../src/event';

describe('EventLog', () => {
  it('should create a valid event log with tableSessionId', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: EventType.CUSTOMER_JOINED_WAITLIST,
      restaurantId: 'rest-1',
      aggregateType: 'WaitlistEntry',
      aggregateId: 'wl-1',
      tableSessionId: 'sess-123',
      payload: { partySize: 4 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.eventType).toBe(EventType.CUSTOMER_JOINED_WAITLIST);
      expect(result.value.restaurantId).toBe('rest-1');
      expect(result.value.aggregateType).toBe('WaitlistEntry');
      expect(result.value.tableSessionId).toBe('sess-123');
      expect(result.value.payload.partySize).toBe(4);
    }
  });

  it('should reject empty eventType', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: '',
      restaurantId: 'rest-1',
      aggregateType: 'WaitlistEntry',
      aggregateId: 'wl-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(EventLogDomainError);
    }
  });

  it('should reject missing restaurantId', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: EventType.CUSTOMER_JOINED_WAITLIST,
      restaurantId: '',
      aggregateType: 'WaitlistEntry',
      aggregateId: 'wl-1',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing aggregateType', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: EventType.CUSTOMER_JOINED_WAITLIST,
      restaurantId: 'rest-1',
      aggregateType: '',
      aggregateId: 'wl-1',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing aggregateId', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: EventType.CUSTOMER_JOINED_WAITLIST,
      restaurantId: 'rest-1',
      aggregateType: 'WaitlistEntry',
      aggregateId: '',
    });

    expect(result.success).toBe(false);
  });

  it('should default payload to empty object', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: EventType.TABLE_CLOSED,
      restaurantId: 'rest-1',
      aggregateType: 'TableSession',
      aggregateId: 'ts-1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.payload).toEqual({});
    }
  });

  it('should store actor information when provided', () => {
    const result = EventLog.create({
      id: 'evt-1',
      eventType: EventType.WAITER_CHANGED,
      restaurantId: 'rest-1',
      aggregateType: 'TableSession',
      aggregateId: 'ts-1',
      actorType: 'Staff',
      actorId: 'staff-1',
      payload: { previousWaiterId: 'w-1', newWaiterId: 'w-2' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.actorType).toBe('Staff');
      expect(result.value.actorId).toBe('staff-1');
    }
  });

  it('should support all 33 event types including new ones', () => {
    const eventTypes = Object.values(EventType);
    expect(eventTypes).toHaveLength(33);
    expect(eventTypes).toContain(EventType.CUSTOMER_JOINED_WAITLIST);
    expect(eventTypes).toContain(EventType.PAYMENT_REGISTERED);
    expect(eventTypes).toContain(EventType.REVIEW_CREATED);
    expect(eventTypes).toContain(EventType.CUSTOMER_REMOVED_FROM_TABLE);
    expect(eventTypes).toContain(EventType.TABLE_CHANGED);
    expect(eventTypes).toContain(EventType.ORDER_CANCELLED);
    expect(eventTypes).toContain(EventType.SERVICE_TASK_CREATED);
    expect(eventTypes).toContain(EventType.KITCHEN_ORDER_ASSIGNED);
    expect(eventTypes).toContain(EventType.TABLE_DEVICE_REGISTERED);
    expect(eventTypes).toContain(EventType.TABLE_DEVICE_ASSOCIATED);
    expect(eventTypes).toContain(EventType.TABLE_DEVICE_DISASSOCIATED);
  });
});
