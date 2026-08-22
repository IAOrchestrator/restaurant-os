import { describe, it, expect } from 'vitest';
import { Actor, ActorType } from '../src/identity';

describe('Actor', () => {
  it('should create a customer actor', () => {
    const actor = Actor.customer('cust-1', 'rest-1');
    expect(actor.type).toBe(ActorType.CUSTOMER);
    expect(actor.id).toBe('cust-1');
    expect(actor.restaurantId).toBe('rest-1');
    expect(actor.isCustomer()).toBe(true);
    expect(actor.isStaff()).toBe(false);
    expect(actor.customerId).toBe('cust-1');
  });

  it('should create a staff actor', () => {
    const actor = Actor.staff('staff-1', 'rest-1');
    expect(actor.type).toBe(ActorType.STAFF);
    expect(actor.id).toBe('staff-1');
    expect(actor.isStaff()).toBe(true);
    expect(actor.staffId).toBe('staff-1');
  });

  it('should create a system actor', () => {
    const actor = Actor.system();
    expect(actor.type).toBe(ActorType.SYSTEM);
    expect(actor.isSystem()).toBe(true);
  });

  it('should carry metadata', () => {
    const actor = Actor.staff('staff-1', 'rest-1', { name: 'John' });
    expect(actor.metadata.name).toBe('John');
  });
});
