import * as argon2 from 'argon2';
import type { CredentialHasher } from '@restaurant-os/application';

export interface Argon2HasherOptions {
  type?: 0 | 1 | 2; // argon2d = 0, argon2i = 1, argon2id = 2
  memoryCost?: number; // KiB (default: 65536 = 64MB)
  timeCost?: number;   // iterations (default: 3)
  parallelism?: number; // threads (default: 4)
  hashLength?: number; // bytes (default: 32)
}

export class Argon2PasswordHasher implements CredentialHasher {
  private readonly options: argon2.HashOptions;

  constructor(options?: Argon2HasherOptions) {
    this.options = {
      type: options?.type ?? argon2.argon2id,
      memoryCost: options?.memoryCost ?? 65536,
      timeCost: options?.timeCost ?? 3,
      parallelism: options?.parallelism ?? 4,
      hashLength: options?.hashLength ?? 32,
    };
  }

  async hash(plainText: string): Promise<string> {
    if (!plainText || typeof plainText !== 'string') {
      throw new Error('Cannot hash empty or non-string credential');
    }
    const result = await argon2.hash(plainText, this.options);
    return result as string;
  }

  async verify(hash: string, plainText: string): Promise<boolean> {
    if (!hash || !plainText || typeof hash !== 'string' || typeof plainText !== 'string') {
      return false;
    }
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      // Gracefully handle malformed or corrupted hashes
      return false;
    }
  }

  async hashPin(pin: string): Promise<string> {
    if (!pin || typeof pin !== 'string') {
      throw new Error('Cannot hash empty or non-string PIN');
    }
    return this.hash(pin);
  }

  async verifyPin(hash: string, pin: string): Promise<boolean> {
    return this.verify(hash, pin);
  }

  async hashDeviceSecret(secret: string): Promise<string> {
    if (!secret || typeof secret !== 'string') {
      throw new Error('Cannot hash empty or non-string device secret');
    }
    return this.hash(secret);
  }

  async verifyDeviceSecret(hash: string, secret: string): Promise<boolean> {
    return this.verify(hash, secret);
  }
}
