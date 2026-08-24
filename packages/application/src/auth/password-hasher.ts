export interface PasswordHasher {
  /**
   * Hashes a raw secret (password, token or PIN) using a memory-hard algorithm.
   */
  hash(plainText: string): Promise<string>;

  /**
   * Cryptographically verifies a plain text secret against a stored hash.
   * Returns false without throwing if the hash format is invalid or corrupted.
   */
  verify(hash: string, plainText: string): Promise<boolean>;
}

export interface CredentialHasher extends PasswordHasher {
  /**
   * Convenience helper for operational PINs
   */
  hashPin(pin: string): Promise<string>;
  verifyPin(hash: string, pin: string): Promise<boolean>;

  /**
   * Convenience helper for device secrets / API keys
   */
  hashDeviceSecret(secret: string): Promise<string>;
  verifyDeviceSecret(hash: string, secret: string): Promise<boolean>;
}
