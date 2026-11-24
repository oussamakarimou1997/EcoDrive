// Pure Web Crypto API utilities for Cloudflare Workers (no Node.js crypto or Buffer).

const PBKDF2_PREFIX = 'pbkdf2_sha256';
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return new Uint8Array(digest);
}

export async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(await sha256Bytes(value));
}

export function generateRandomHexToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashAccessCodePbkdf2(accessCode: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(accessCode),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    DERIVED_BITS
  );

  const derivedBytes = new Uint8Array(derivedBuffer);
  return `${PBKDF2_PREFIX}:${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(derivedBytes)}`;
}

export async function verifyAccessCodeHash(
  accessCode: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) {
    return false;
  }

  const iterations = Number.parseInt(parts[1], 10);
  const saltBytes = hexToBytes(parts[2]);
  const expectedBytes = hexToBytes(parts[3]);
  if (
    !Number.isFinite(iterations) ||
    iterations < 10000 ||
    iterations > 1000000 ||
    !saltBytes ||
    !expectedBytes
  ) {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(accessCode),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    expectedBytes.length * 8
  );

  const derivedBytes = new Uint8Array(derivedBuffer);
  return timingSafeEqualBytes(derivedBytes, expectedBytes);
}

export async function verifyEnvAccessCodeConstantTime(
  inputCode: string,
  envCode: string
): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Bytes(inputCode), sha256Bytes(envCode)]);
  return timingSafeEqualBytes(a, b);
}
