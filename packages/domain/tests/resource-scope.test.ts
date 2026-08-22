import { describe, it, expect } from 'vitest';
import { ResourceScope, ResourceScopeType } from '../src/auth';

describe('ResourceScope', () => {
  it('should create OWN scope', () => {
    const scope = ResourceScope.own(['res-1', 'res-2']);
    expect(scope.type).toBe(ResourceScopeType.OWN);
    expect(scope.canAccess('res-1')).toBe(true);
    expect(scope.canAccess('res-3')).toBe(false);
  });

  it('should create RESTAURANT scope', () => {
    const scope = ResourceScope.restaurant();
    expect(scope.type).toBe(ResourceScopeType.RESTAURANT);
    expect(scope.canAccess('any-id')).toBe(true);
  });

  it('should create GLOBAL scope', () => {
    const scope = ResourceScope.global();
    expect(scope.type).toBe(ResourceScopeType.GLOBAL);
    expect(scope.isGlobal()).toBe(true);
  });

  it('should support null resourceIds (all within scope type)', () => {
    const scope = ResourceScope.own();
    expect(scope.canAccess('anything')).toBe(true);
  });
});
