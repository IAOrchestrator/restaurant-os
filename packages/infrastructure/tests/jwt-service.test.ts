import { describe, it, expect } from 'vitest';
import { JwtService } from '../src/auth/jwt-service';
import { StaffRole } from '@restaurant-os/domain';

describe('JwtService', () => {
  const secret = 'super_secret_test_key_12345';
  const jwt = new JwtService(secret);

  it('signs and verifies a Staff token', () => {
    const payload = {
      sub: 'staff-101',
      type: 'STAFF' as const,
      restaurantId: 'rest-001',
      roles: [StaffRole.WAITER],
      name: 'Mateo Silva',
    };

    const token = jwt.sign(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = jwt.verify(token);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.value.sub).toBe('staff-101');
      expect(verified.value.type).toBe('STAFF');
      expect(verified.value.restaurantId).toBe('rest-001');
      expect((verified.value as any).name).toBe('Mateo Silva');
      expect((verified.value as any).roles).toEqual([StaffRole.WAITER]);
    }
  });

  it('signs and verifies a TableDevice token', () => {
    const payload = {
      sub: 'device-202',
      type: 'TABLE_DEVICE' as const,
      restaurantId: 'rest-001',
      tableId: 'table-1',
      name: 'Tablet Mesa 1',
    };

    const token = jwt.sign(payload);
    const verified = jwt.verify(token);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.value.sub).toBe('device-202');
      expect(verified.value.type).toBe('TABLE_DEVICE');
      expect((verified.value as any).tableId).toBe('table-1');
    }
  });

  it('signs and verifies a Customer token', () => {
    const payload = {
      sub: 'cust-303',
      type: 'CUSTOMER' as const,
      restaurantId: 'rest-001',
      tableSessionId: 'session-888',
      name: 'Juan Perez',
    };

    const token = jwt.sign(payload);
    const verified = jwt.verify(token);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.value.sub).toBe('cust-303');
      expect(verified.value.type).toBe('CUSTOMER');
      expect((verified.value as any).tableSessionId).toBe('session-888');
    }
  });

  it('fails verification if token was signed with a different secret', () => {
    const otherJwt = new JwtService('different_secret_key');
    const token = otherJwt.sign({
      sub: 'staff-1',
      type: 'STAFF',
      restaurantId: 'rest-1',
      roles: [],
    });

    const result = jwt.verify(token);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('signature');
    }
  });

  it('fails verification if token has expired', () => {
    // Expired 10 seconds ago
    const token = jwt.sign(
      { sub: 'staff-1', type: 'STAFF', restaurantId: 'rest-1', roles: [] },
      -10,
    );

    const result = jwt.verify(token);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('expired');
    }
  });

  it('fails verification on malformed tokens', () => {
    expect(jwt.verify('').success).toBe(false);
    expect(jwt.verify('invalid.token').success).toBe(false);
    expect(jwt.verify('a.b.c.d').success).toBe(false);
  });
});
