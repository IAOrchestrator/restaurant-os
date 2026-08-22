import { describe, it, expect } from 'vitest';
import {
  Account,
  AccountStatus,
  AccountDomainError,
} from '../src/billing/entity';

describe('Account aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    tableSessionId: '550e8400-e29b-41d4-a716-446655440002',
  };

  it('creates with OPEN status and zero total', () => {
    const result = Account.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(AccountStatus.OPEN);
      expect(result.value.totalAmount).toBe(0);
      expect(result.value.paidAmount).toBe(0);
      expect(result.value.isFullyPaid).toBe(true);
    }
  });

  it('adds order amount in OPEN status', () => {
    const account = Account.create(validProps).value!;
    const updated = account.addOrderAmount(100);
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.totalAmount).toBe(100);
      expect(updated.value.isFullyPaid).toBe(false);
    }
  });

  it('fails to add negative order amount', () => {
    const account = Account.create(validProps).value!;
    const updated = account.addOrderAmount(-10);
    expect(updated.success).toBe(false);
  });

  it('fails to add order amount when not OPEN', () => {
    const account = Account.create(validProps).value!.requestPayment().value!;
    const updated = account.addOrderAmount(50);
    expect(updated.success).toBe(false);
  });

  it('transitions OPEN → REQUESTED', () => {
    const account = Account.create(validProps).value!;
    const requested = account.requestPayment();
    expect(requested.success).toBe(true);
    if (requested.success) {
      expect(requested.value.status).toBe(AccountStatus.REQUESTED);
    }
  });

  it('registers payment and updates status', () => {
    const account = Account.create(validProps).value!
      .addOrderAmount(100).value!
      .requestPayment().value!;
    const updated = account.registerPayment({
      id: 'pay-1',
      amount: 50,
      method: 'cash',
      registeredAt: new Date(),
    });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.paidAmount).toBe(50);
      expect(updated.value.remainingAmount).toBe(50);
      expect(updated.value.isFullyPaid).toBe(false);
      expect(updated.value.status).toBe(AccountStatus.REQUESTED);
    }
  });

  it('registers full payment and transitions to PAID', () => {
    const account = Account.create(validProps).value!
      .addOrderAmount(100).value!
      .requestPayment().value!;
    const updated = account.registerPayment({
      id: 'pay-1',
      amount: 100,
      method: 'card',
      registeredAt: new Date(),
    });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.paidAmount).toBe(100);
      expect(updated.value.remainingAmount).toBe(0);
      expect(updated.value.isFullyPaid).toBe(true);
      expect(updated.value.status).toBe(AccountStatus.PAID);
    }
  });

  it('registers multiple partial payments', () => {
    let account = Account.create(validProps).value!
      .addOrderAmount(100).value!
      .requestPayment().value!;

    account = account.registerPayment({
      id: 'pay-1', amount: 30, method: 'cash', registeredAt: new Date(),
    }).value!;

    account = account.registerPayment({
      id: 'pay-2', amount: 70, method: 'card', registeredAt: new Date(),
    }).value!;

    expect(account.paidAmount).toBe(100);
    expect(account.status).toBe(AccountStatus.PAID);
    expect(account.payments).toHaveLength(2);
  });

  it('fails to register non-positive payment', () => {
    const account = Account.create(validProps).value!;
    const updated = account.registerPayment({
      id: 'pay-1', amount: 0, method: 'cash', registeredAt: new Date(),
    });
    expect(updated.success).toBe(false);
  });

  it('transitions PAID → CLOSED', () => {
    const account = Account.create(validProps).value!
      .addOrderAmount(100).value!
      .requestPayment().value!
      .registerPayment({
        id: 'pay-1', amount: 100, method: 'cash', registeredAt: new Date(),
      }).value!;
    const closed = account.close();
    expect(closed.success).toBe(true);
    if (closed.success) {
      expect(closed.value.status).toBe(AccountStatus.CLOSED);
    }
  });

  it('fails to close if not PAID', () => {
    const account = Account.create(validProps).value!;
    const closed = account.close();
    expect(closed.success).toBe(false);
  });

  it('fails to request payment when not OPEN', () => {
    const account = Account.create(validProps).value!.requestPayment().value!;
    const requested = account.requestPayment();
    expect(requested.success).toBe(false);
  });

  it('is immutable', () => {
    const account = Account.create(validProps).value!;
    account.requestPayment();
    expect(account.status).toBe(AccountStatus.OPEN);
  });
});
