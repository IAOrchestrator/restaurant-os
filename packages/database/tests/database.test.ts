import { describe, it, expect } from 'vitest';
import { PrismaClient } from '../src/index';

describe('Database package', () => {
  it('exports PrismaClient', () => {
    expect(PrismaClient).toBeDefined();
    expect(typeof PrismaClient).toBe('function');
  });
});
