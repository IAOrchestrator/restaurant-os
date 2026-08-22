import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/index';

describe('Config', () => {
  it('loads config with default and environment values', () => {
    const config = loadConfig();
    expect(['development', 'test', 'production']).toContain(config.nodeEnv);
    expect(config.port).toBe(3000);
    expect(config.apiVersion).toBe('0.1.0');
    expect(config.databaseUrl).toBeDefined();
  });
});
