import { describe, it, expect } from 'vitest';
import {
  WaitlistEntry,
  WaitlistStatus,
  WaitlistDomainError,
} from '../src/waitlist/entity';

describe('WaitlistEntry aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    customerId: '550e8400-e29b-41d4-a716-446655440002',
    partySize: 4,
  };

  it('creates with PREPARED status by default', () => {
    const result = WaitlistEntry.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(WaitlistStatus.PREPARED);
      expect(result.value.partySize).toBe(4);
    }
  });

  it('fails to create with non-positive partySize', () => {
    const result = WaitlistEntry.create({ ...validProps, partySize: 0 });
    expect(result.success).toBe(false);
  });

  it('transitions PREPARED → WAITING', () => {
    const entry = WaitlistEntry.create(validProps).value!;
    const joined = entry.joinQueue();
    expect(joined.success).toBe(true);
    if (joined.success) {
      expect(joined.value.status).toBe(WaitlistStatus.WAITING);
    }
  });

  it('transitions WAITING → CALLED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!;
    const called = entry.call();
    expect(called.success).toBe(true);
    if (called.success) {
      expect(called.value.status).toBe(WaitlistStatus.CALLED);
      expect(called.value.calledAt).not.toBeNull();
    }
  });

  it('transitions CALLED → CUSTOMER_CONFIRMED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!;
    const confirmed = entry.confirm();
    expect(confirmed.success).toBe(true);
    if (confirmed.success) {
      expect(confirmed.value.status).toBe(WaitlistStatus.CUSTOMER_CONFIRMED);
    }
  });

  it('transitions CUSTOMER_CONFIRMED → WAITING_FOR_SEATING', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!.confirm().value!;
    const waiting = entry.markWaitingForSeating();
    expect(waiting.success).toBe(true);
    if (waiting.success) {
      expect(waiting.value.status).toBe(WaitlistStatus.WAITING_FOR_SEATING);
    }
  });

  it('transitions WAITING_FOR_SEATING → SEATED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!.confirm().value!.markWaitingForSeating().value!;
    const seated = entry.seat();
    expect(seated.success).toBe(true);
    if (seated.success) {
      expect(seated.value.status).toBe(WaitlistStatus.SEATED);
      expect(seated.value.seatedAt).not.toBeNull();
    }
  });

  it('allows cancel from WAITING', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!;
    const cancelled = entry.cancel();
    expect(cancelled.success).toBe(true);
    if (cancelled.success) {
      expect(cancelled.value.status).toBe(WaitlistStatus.CANCELLED);
      expect(cancelled.value.cancelledAt).not.toBeNull();
    }
  });

  it('allows cancel from CALLED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!;
    const cancelled = entry.cancel();
    expect(cancelled.success).toBe(true);
  });

  it('allows takeaway from WAITING', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!;
    const takeaway = entry.selectTakeaway();
    expect(takeaway.success).toBe(true);
    if (takeaway.success) {
      expect(takeaway.value.status).toBe(WaitlistStatus.TAKEAWAY);
    }
  });

  it('allows expire from CALLED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!;
    const expired = entry.expire();
    expect(expired.success).toBe(true);
    if (expired.success) {
      expect(expired.value.status).toBe(WaitlistStatus.EXPIRED);
    }
  });

  it('allows no-show from CALLED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!;
    const noShow = entry.markNoShow();
    expect(noShow.success).toBe(true);
    if (noShow.success) {
      expect(noShow.value.status).toBe(WaitlistStatus.NO_SHOW);
    }
  });

  it('fails invalid transitions', () => {
    const entry = WaitlistEntry.create(validProps).value!;
    expect(entry.call().success).toBe(false);
    expect(entry.confirm().success).toBe(false);
    expect(entry.seat().success).toBe(false);
    expect(entry.expire().success).toBe(false);
  });

  it('fails to cancel from SEATED', () => {
    const entry = WaitlistEntry.create(validProps).value!.joinQueue().value!.call().value!.confirm().value!.markWaitingForSeating().value!.seat().value!;
    const cancelled = entry.cancel();
    expect(cancelled.success).toBe(false);
  });

  it('is immutable', () => {
    const entry = WaitlistEntry.create(validProps).value!;
    entry.joinQueue();
    expect(entry.status).toBe(WaitlistStatus.PREPARED);
  });
});
