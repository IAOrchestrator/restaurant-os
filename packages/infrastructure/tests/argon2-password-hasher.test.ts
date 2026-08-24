import { describe, it, expect } from 'vitest';
import { Argon2PasswordHasher } from '../src/auth/argon2-password-hasher';

describe('Argon2PasswordHasher — Secure Credential Hashing (Step 3.1)', () => {
  const hasher = new Argon2PasswordHasher();

  it('1. Hashes a plain-text password and generates an Argon2id formatted hash', async () => {
    const plainText = 'SuperSecretP@ssword2026!';
    const hash = await hasher.hash(plainText);

    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(plainText);
  });

  it('2. Successfully verifies the correct password against the hash', async () => {
    const plainText = 'CorrectHorseBatteryStaple';
    const hash = await hasher.hash(plainText);

    const isValid = await hasher.verify(hash, plainText);
    expect(isValid).toBe(true);
  });

  it('3. Rejects an incorrect password against the hash', async () => {
    const plainText = 'RightPassword123';
    const wrongText = 'WrongPassword456';
    const hash = await hasher.hash(plainText);

    const isValid = await hasher.verify(hash, wrongText);
    expect(isValid).toBe(false);
  });

  it('4. Generates unique hashes for the same secret due to automatic cryptographic salting', async () => {
    const plainText = 'IdenticalSecretValue';
    const hash1 = await hasher.hash(plainText);
    const hash2 = await hasher.hash(plainText);

    expect(hash1).not.toBe(hash2);
    // Both must still verify against the original secret
    expect(await hasher.verify(hash1, plainText)).toBe(true);
    expect(await hasher.verify(hash2, plainText)).toBe(true);
  });

  it('5. Rejects empty or invalid plain-text inputs on hash() with descriptive error', async () => {
    await expect(hasher.hash('')).rejects.toThrow('Cannot hash empty or non-string credential');
    await expect(hasher.hash(null as any)).rejects.toThrow('Cannot hash empty or non-string credential');
    await expect(hasher.hash(undefined as any)).rejects.toThrow('Cannot hash empty or non-string credential');
  });

  it('6. Handles malformed or corrupted hashes safely without crashing on verify()', async () => {
    expect(await hasher.verify('invalid-hash-string', 'secret')).toBe(false);
    expect(await hasher.verify('$argon2id$v=19$corrupted_payload', 'secret')).toBe(false);
    expect(await hasher.verify('', 'secret')).toBe(false);
    expect(await hasher.verify(null as any, 'secret')).toBe(false);
    expect(await hasher.verify('$argon2id$v=19$m=65536,p=4,t=3$dummy', '')).toBe(false);
  });

  it('7. Supports configurable cost parameters (memoryCost, timeCost, parallelism)', async () => {
    const fastHasher = new Argon2PasswordHasher({
      memoryCost: 16384, // 16 MB
      timeCost: 2,
      parallelism: 2,
    });

    const secret = 'CustomCostPassword!';
    const hash = await fastHasher.hash(secret);

    expect(hash).toContain('m=16384,p=2,t=2');
    expect(await fastHasher.verify(hash, secret)).toBe(true);
  });

  it('8. Supports operational PIN hashing and verification via hashPin and verifyPin', async () => {
    const pin = '4829';
    const pinHash = await hasher.hashPin(pin);

    expect(pinHash.startsWith('$argon2id$')).toBe(true);
    expect(await hasher.verifyPin(pinHash, '4829')).toBe(true);
    expect(await hasher.verifyPin(pinHash, '0000')).toBe(false);
  });

  it('9. Supports TableDevice secret hashing and verification via hashDeviceSecret and verifyDeviceSecret', async () => {
    const deviceSecret = 'device-secret-key-tablet-table-5-xyz789';
    const secretHash = await hasher.hashDeviceSecret(deviceSecret);

    expect(secretHash.startsWith('$argon2id$')).toBe(true);
    expect(await hasher.verifyDeviceSecret(secretHash, deviceSecret)).toBe(true);
    expect(await hasher.verifyDeviceSecret(secretHash, 'fake-device-secret')).toBe(false);
  });

  it('10. Separates device secrets from staff credentials and rejects cross-verification', async () => {
    const staffPassword = 'AdminSecretPassword#1';
    const deviceApiKey = 'dev-tablet-01-api-key';

    const staffHash = await hasher.hash(staffPassword);
    const deviceHash = await hasher.hashDeviceSecret(deviceApiKey);

    expect(await hasher.verify(staffHash, deviceApiKey)).toBe(false);
    expect(await hasher.verifyDeviceSecret(deviceHash, staffPassword)).toBe(false);
  });
});
