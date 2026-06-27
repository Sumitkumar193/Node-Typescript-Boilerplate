import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import { encryptJobPayload, decryptJobPayload } from '@services/BullMQService';

const key = () => randomBytes(32).toString('hex');

describe('encryptJobPayload / decryptJobPayload', () => {
  beforeEach(() => { process.env.JOB_ENCRYPTION_KEY = key(); });
  afterEach(() => { delete process.env.JOB_ENCRYPTION_KEY; });

  it('round-trips arbitrary payloads', () => {
    const payload = { token: 'reset-abc123', html: '<a href="?token=abc123">Reset</a>', nested: { n: 42 } };
    expect(decryptJobPayload(encryptJobPayload(payload))).toEqual(payload);
  });

  it('ciphertext does not contain plaintext secrets', () => {
    const blob = encryptJobPayload({ token: 'super-secret-reset-token' });
    expect(String(blob)).not.toContain('super-secret-reset-token');
  });

  it('tampered ciphertext throws on decrypt', () => {
    const blob = encryptJobPayload({ x: 1 }) as string;
    const raw = Buffer.from(blob.slice('enc:'.length), 'base64');
    raw[raw.length - 1] ^= 0xff; // flip last byte
    expect(() => decryptJobPayload('enc:' + raw.toString('base64'))).toThrow();
  });

  it('wrong key throws on decrypt', () => {
    const blob = encryptJobPayload({ x: 1 });
    process.env.JOB_ENCRYPTION_KEY = key(); // different key
    expect(() => decryptJobPayload(blob)).toThrow();
  });

  it('throws when JOB_ENCRYPTION_KEY is not set', () => {
    delete process.env.JOB_ENCRYPTION_KEY;
    expect(() => encryptJobPayload({ x: 1 })).toThrow('JOB_ENCRYPTION_KEY');
  });
});
